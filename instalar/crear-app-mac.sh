#!/bin/bash
# (2026-11-25e) Se movió a app/inicio/crear-app-mac.sh (viaja en el paquete). Esto queda para quien lo corra a mano.
exec bash "$(cd "$(dirname "$0")/.." && pwd)/app/inicio/crear-app-mac.sh" "$@"
