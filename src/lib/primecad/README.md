# PrimeCAD

Motor CAD do PrimeDocs para gerar modelos paramétricos de impressão 3D diretamente em JavaScript/TypeScript.

O primeiro gerador é o Quebra-Cabeça Magnético 2x2. A versão carregada pelo PWA fica em `js/primecad/puzzleGenerator.js`; esta pasta organiza a arquitetura reutilizável para evoluir o motor com build no futuro.

## Pipeline

Configuração paramétrica → linhas internas do quebra-cabeça → cilindros de ímã → malha negativa → STL → ZIP.

Nesta etapa, o PrimeCAD gera um molde/cortador STL para ser usado como Negative Part no Bambu Studio.

## Pastas

- `geometry/`: primitivas 2D e peças paramétricas.
- `svg/`: leitura, vetorização e separação por cor.
- `mesh/`: extrusão, triangulação e malhas.
- `export/`: STL e ZIP.
- `generators/`: geradores finais.
- `utils/`: matemática e helpers.
