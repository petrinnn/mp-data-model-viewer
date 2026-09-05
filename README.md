# Data Model Viewer

Ferramenta **100% local** para modelar tabelas, campos e relacionamentos num `data-model.json`.  
Não conecta em Supabase nem em nenhuma ferramenta externa — só lê/grava o JSON e desenha o diagrama.

Funciona com **Cursor, VS Code, Claude Code, Codex** e qualquer agente que leia arquivos do projeto.

## O que vem no pacote

| Item | Pra quê |
| --- | --- |
| `Abrir.command` (Mac) / `Abrir.bat` (Windows) | Única coisa que você precisa executar no PC |
| `setup/` | Programa interno — **não precisa mexer** |
| `model-viewer/` | Cola na **raiz** de cada projeto de app |

---

## 1) Instalar no PC (1x)

1. Salve esta pasta inteira num local **fix** (que você não vai ficar movendo), por exemplo:
   - Windows: `C:\Data Model Viewer`
   - Mac: `~/Applications/Data Model Viewer` ou Documentos
2. Execute o **Abrir** que está **na raiz** (ao lado de `setup/`):
   - Mac: `Abrir.command`
   - Windows: `Abrir.bat`  
   Isso sobe o viewer e **registra** a pasta `setup/` neste PC.
3. (Opcional) Crie um atalho do Abrir na área de trabalho.

Se mover a pasta depois, rode o Abrir de novo.

---

## 2) Preparar cada projeto de app (1x por projeto)

1. Copie a pasta **`model-viewer`** para a **raiz** do app em que você está trabalhando.
2. No terminal do projeto, rode **uma vez**:

```bash
node model-viewer
```

(Use este comando na 1ª vez — funciona mesmo se o projeto ainda **não** tiver `package.json`.)

Isso vai:

- criar o `data-model.json`, se ainda não existir  
- criar as instruções para o agente (`data-model.md` + regra do Cursor)  
- criar/atualizar o `package.json` com o script `model`  
- abrir o visualizador nesse projeto  

Nas próximas vezes neste mesmo projeto:

```bash
npm run model
```

(ou de novo `node model-viewer` — os dois servem)
---

## 3) Modelar os dados com o seu agente

Peça a modelagem **seguindo as instruções** de:

- `data-model.md` — qualquer ferramenta  
- ou `.cursor/rules/data-model.mdc` — Cursor

Exemplo:

> Modele os dados deste app conforme as instruções do `data-model.md`.

Depois você pode:

- pedir para o agente abrir o visualizador (`npm run model`), **ou**
- usar o atalho Abrir e carregar o `data-model.json` do projeto

---

## 4) Trazer tabelas do Supabase (ou outro banco)

O Viewer **não** fala com o banco sozinho.

Se o projeto já tiver **MCP** (ou o agente tiver acesso ao schema), peça:

> Leia as tabelas do Supabase e monte o `data-model.json` na estrutura das instruções.

---

## 5) Do diagrama para o banco

> Crie o schema no Supabase conforme o `data-model.json`.

Quem aplica migration é o **agente**. O Viewer só mostra o contrato.

---

## Lembrete

- Roda **local**, no seu PC  
- **Não envia** e **não recebe** dados de serviços externos  
- Olha só o `data-model.json` e desenha os relacionamentos  
