"""Red STTN para inpainting de video (researchmm/STTN, licencia MIT; pesos 'sttn-det' de
YaoFANGUK/video-subtitle-remover, en modelos/sttn.pth).

Solo la importa borrar_texto.py dentro del entorno con torch. Cambios frente al original: atención
con q pre-escalado, softmax en fp32 (segura en fp16) y por trozos de consultas; el masked_fill del
original no hacía nada y se quitó. La entrada debe medir alto múltiplo de 240 y ancho múltiplo de 432.
"""
import math

import torch
import torch.nn as nn
import torch.nn.functional as F


class deconv(nn.Module):
    def __init__(self, cin, cout, kernel_size=3, padding=0):
        super().__init__()
        self.conv = nn.Conv2d(cin, cout, kernel_size=kernel_size, stride=1, padding=padding)

    def forward(self, x):
        return self.conv(F.interpolate(x, scale_factor=2, mode="bilinear", align_corners=True))


def _atencion(q, k, v, trozo=8192):
    escala = 1.0 / math.sqrt(q.size(-1))
    kt = k.transpose(-2, -1)
    out = torch.empty_like(q[..., :v.size(-1)])
    for s in range(0, q.size(1), trozo):
        p = torch.softmax(torch.matmul(q[:, s:s + trozo] * escala, kt).float(), dim=-1).to(v.dtype)
        out[:, s:s + trozo] = torch.matmul(p, v)
    return out


class MultiHeadedAttention(nn.Module):
    def __init__(self, patchsize, d_model):
        super().__init__()
        self.patchsize = patchsize
        self.query_embedding = nn.Conv2d(d_model, d_model, kernel_size=1, padding=0)
        self.value_embedding = nn.Conv2d(d_model, d_model, kernel_size=1, padding=0)
        self.key_embedding = nn.Conv2d(d_model, d_model, kernel_size=1, padding=0)
        self.output_linear = nn.Sequential(nn.Conv2d(d_model, d_model, kernel_size=3, padding=1),
                                           nn.LeakyReLU(0.2, inplace=True))

    def forward(self, x, b, c):
        bt, _, h, w = x.size()
        t = bt // b
        d_k = c // len(self.patchsize)
        out = torch.empty_like(x)
        for hi, (pw, ph) in enumerate(self.patchsize):
            sl = slice(hi * d_k, (hi + 1) * d_k)
            ow, oh = w // pw, h // ph

            def tok(emb):
                z = F.conv2d(x, emb.weight[sl], emb.bias[sl]).reshape(b, t, d_k, oh, ph, ow, pw)
                return z.permute(0, 1, 3, 5, 2, 4, 6).reshape(b, t * oh * ow, d_k * ph * pw)
            y = _atencion(tok(self.query_embedding), tok(self.key_embedding), tok(self.value_embedding))
            out[:, sl] = y.view(b, t, oh, ow, d_k, ph, pw).permute(0, 1, 4, 2, 5, 3, 6).reshape(bt, d_k, h, w)
        return self.output_linear(out)


class FeedForward(nn.Module):
    def __init__(self, d_model):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv2d(d_model, d_model, kernel_size=3, padding=2, dilation=2), nn.LeakyReLU(0.2, inplace=True),
            nn.Conv2d(d_model, d_model, kernel_size=3, padding=1), nn.LeakyReLU(0.2, inplace=True))

    def forward(self, x):
        return self.conv(x)


class TransformerBlock(nn.Module):
    def __init__(self, patchsize, hidden=128):
        super().__init__()
        self.attention = MultiHeadedAttention(patchsize, d_model=hidden)
        self.feed_forward = FeedForward(hidden)

    def forward(self, x, b, c):
        x = x + self.attention(x, b, c)
        return x + self.feed_forward(x)


class InpaintGenerator(nn.Module):
    def __init__(self):
        super().__init__()
        canal, patchsize = 256, [(108, 60), (36, 20), (18, 10), (9, 5)]
        self.transformer = nn.ModuleList([TransformerBlock(patchsize, hidden=canal) for _ in range(8)])
        self.encoder = nn.Sequential(
            nn.Conv2d(3, 64, kernel_size=3, stride=2, padding=1), nn.LeakyReLU(0.2, inplace=True),
            nn.Conv2d(64, 64, kernel_size=3, stride=1, padding=1), nn.LeakyReLU(0.2, inplace=True),
            nn.Conv2d(64, 128, kernel_size=3, stride=2, padding=1), nn.LeakyReLU(0.2, inplace=True),
            nn.Conv2d(128, canal, kernel_size=3, stride=1, padding=1), nn.LeakyReLU(0.2, inplace=True))
        self.decoder = nn.Sequential(
            deconv(canal, 128, kernel_size=3, padding=1), nn.LeakyReLU(0.2, inplace=True),
            nn.Conv2d(128, 64, kernel_size=3, stride=1, padding=1), nn.LeakyReLU(0.2, inplace=True),
            deconv(64, 64, kernel_size=3, padding=1), nn.LeakyReLU(0.2, inplace=True),
            nn.Conv2d(64, 3, kernel_size=3, stride=1, padding=1))

    def cargar(self, ruta):
        self.load_state_dict(torch.load(ruta, map_location="cpu", weights_only=False)["netG"], strict=True)
        return self

    def run(self, x, n_out):
        """x: (T,3,H,W) en [-1,1] con los huecos a 0. Devuelve los n_out primeros cuadros en [0,1]."""
        feat = self.encoder(x)
        c = feat.size(1)
        for blk in self.transformer:
            feat = blk(feat, 1, c)
        return (torch.tanh(self.decoder(feat[:n_out])) + 1) / 2
