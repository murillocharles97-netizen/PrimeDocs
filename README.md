# PrimeDocs

PWA para gestão de impressão 3D, produtos consignados, lojas parceiras, conferências de vendas e geração de documentos em PDF.

O PrimeDocs funciona diretamente no navegador, armazena os dados localmente e pode ser instalado em computadores e celulares. O sistema também possui backup e restauração em JSON para sincronização manual entre dispositivos.

## Funcionalidades

- Dashboard operacional e financeiro.
- Cadastro de produtos e lojas parceiras.
- Controle do estoque atual por loja.
- Emissão de consignados em PDF.
- Conferência de vendas e atualização de estoque.
- Histórico de consignados e conferências.
- Backup e restauração completa em JSON.
- Temas claro e escuro.
- Funcionamento offline após o primeiro carregamento.
- Instalação como aplicativo pelo navegador.

## Tecnologias

- HTML5
- CSS3
- JavaScript puro
- LocalStorage
- Service Worker e Web App Manifest
- jsPDF e html2canvas
- Lucide Icons

Não são utilizados frameworks como React, Vue ou Bootstrap.

## Estrutura principal

```text
PrimeDocs/
├── assets/                 # Marca e ícones do PWA
├── css/                    # Estilos e temas
├── js/
│   ├── components/         # Componentes reutilizáveis
│   ├── config/             # Configurações do aplicativo
│   ├── app.js              # Inicialização e service worker
│   ├── pdf.js              # Geração de documentos
│   ├── router.js           # Navegação interna
│   └── storage.js          # Persistência e backup
├── pages/                  # Páginas funcionais
├── scripts/                # Ferramentas de manutenção
├── index.html
├── manifest.json
└── service-worker.js
```

## Como executar localmente

O service worker exige `http://` ou `https://`. Evite abrir o `index.html` diretamente como arquivo.

Com Python:

```bash
python -m http.server 8080
```

Depois acesse:

```text
http://localhost:8080
```

Também é possível usar qualquer servidor estático, como Live Server.

## PWA e instalação

Após acessar o PrimeDocs por HTTPS ou localhost:

1. Aguarde o primeiro carregamento para que os recursos sejam armazenados.
2. No Android, abra o menu do navegador.
3. Selecione **Instalar aplicativo** ou **Adicionar à tela inicial**.
4. Confirme a instalação.

O aplicativo instalado utiliza a versão publicada na branch `main`.

## Estratégia de branches

```text
dev  ── desenvolvimento e validação
 │
 └── merge aprovado
        │
        ▼
main ── versão estável e publicada
```

### `main`

- Contém somente versões estáveis e testadas.
- É a origem do GitHub Pages.
- É a versão utilizada pelo PWA instalado.

### `dev`

- É a branch padrão para desenvolvimento local.
- Recebe novas funcionalidades, correções e testes.
- Pode ficar temporariamente instável.

## Fluxo de desenvolvimento

Atualize a `dev` antes de começar:

```bash
git switch dev
git pull origin dev
```

Depois de desenvolver e testar:

```bash
git add .
git commit -m "feat: descrição da alteração"
git push origin dev
```

## Publicar uma versão estável

Após validar a branch `dev`:

```bash
git switch main
git pull origin main
git merge --no-ff dev
git push origin main
git switch dev
```

Como o GitHub Pages utiliza `main`, o push inicia a publicação da nova versão estável.

## GitHub Pages

No repositório do GitHub:

1. Acesse **Settings** → **Pages**.
2. Em **Build and deployment**, selecione **Deploy from a branch**.
3. Escolha a branch `main` e a pasta `/ (root)`.
4. Salve a configuração.

A publicação fica disponível no formato:

```text
https://murillocharles97-netizen.github.io/PrimeDocs/
```

## Backup dos dados

Em **Configurações → Backup**:

- **Exportar Dados** gera um arquivo JSON com todos os dados.
- **Importar Dados** substitui os dados atuais após confirmação.

Faça um backup antes de trocar de dispositivo ou importar outro arquivo.

## Regenerar os ícones

O script abaixo recria os PNGs a partir da identidade visual do projeto:

```bash
python scripts/generate-icons.py
```

O script requer Pillow.

## Publicação inicial no GitHub

```bash
git remote add origin https://github.com/murillocharles97-netizen/PrimeDocs.git
git push -u origin main
git push -u origin dev
```

## Licença

Projeto privado do PrimeDocs. Defina uma licença antes de disponibilizar o código publicamente.
