# Data Model Viewer: especificação (MVP)

## Fonte oficial

O `data-model.json` é a **única** fonte de dados do Viewer.

O Viewer **não** se conecta ao Supabase (nem pede URL, keys, senha ou qualquer credencial).

Trabalha só com arquivos locais do projeto alvo.

## Papéis

```text
MODELAGEM (UI)
     ↓
data-model.json   ← contrato entre dev, agente e viewer
     ↓
AGENTE do projeto (fora deste tool)
     ↓
BANCO REAL
```

- Viewer: visualizar, desenhar, documentar, salvar JSON.
- Agente/projeto: ler o JSON, gerar/aplicar migrations, sincronizar schema → JSON.

## Fluxos

Banco existente:

```text
Supabase → agente consulta schema → atualiza data-model.json
→ Viewer detecta alteração → diagrama atualiza
```

Alterações planejadas:

```text
Viewer → usuário edita → salva data-model.json
→ agente identifica diff → cria/aplica migrations
```

## CLI

```bash
cd /caminho/do/projeto
model-viewer .
```

Toda leitura/gravação usa `/caminho/do/projeto/data-model.json`.
Não criar cópia interna da modelagem dentro do repositório do Viewer.

## MVP

1. Abrir projeto com `model-viewer .`
2. Encontrar (ou criar template de) `data-model.json`
3. Exibir diagrama
4. Criar e editar tabelas
5. Criar e editar campos
6. Criar/remover relacionamentos
7. Arrastar e organizar tabelas
8. Salvar no `data-model.json` original
9. Detectar alterações externas (Cursor/agente)
10. Atualizar o diagrama automaticamente

## Fora do escopo

- Conexão direta com Supabase
- Migrations / SQL
- Alterar banco de dados
