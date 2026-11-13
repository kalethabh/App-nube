# Continuidad del desarrollo de Kads Studio

Estas instrucciones son para trabajar en el desarrollo del repositorio. Si una tarea enviada por la propia app
indica «MODO APP», sigue sus instrucciones de producción; no cambies documentación ni hagas operaciones de Git
como parte de generar un anuncio.

## Antes de trabajar

- Lee `CONTEXTO-PROYECTO.md` y `CLAUDE.md`. El contexto describe el estado actual, las decisiones y los pendientes.
- Habla en español sencillo: el usuario no es programador.
- Conserva el diseño de Kads Studio salvo que el usuario pida modificarlo.

## Mantener y subir el contexto

Instrucción expresa del usuario del 2026-11-11: **«Sube siempre el contexto para continuar en cualquier lado».**

- Al terminar cada cambio de desarrollo, corrección o decisión relevante, actualiza `CONTEXTO-PROYECTO.md`.
- Incluye qué quedó terminado, los enlaces a commits o PRs que ya existan, la validación realizada, sus límites,
  los pendientes reales y el siguiente paso. Distingue lo implementado de lo probado en simulación o en la Mac.
- Guarda y sube el contexto a GitHub junto con los cambios, siguiendo el flujo de ramas y PRs del proyecto.
  No hace falta volver a pedir autorización para mantener y subir este contexto.
- Antes de decir que está subido, comprueba que el archivo actualizado está en `main`. Si la publicación queda
  bloqueada, conserva el trabajo local y explica qué falta; no afirmes que la otra conversación ya puede leerlo.
- Una conversación nueva debe poder continuar leyendo los archivos del repositorio, sin depender de mensajes
  de un chat anterior. No guardes claves, contenido de `.env`, credenciales ni anuncios personales en el contexto.

Para las demás reglas de producción, pruebas y Git, sigue `CLAUDE.md` y los acuerdos de `CONTEXTO-PROYECTO.md`.
