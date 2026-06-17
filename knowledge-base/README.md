# Knowledge Base

Este servico concentra a base de conhecimento institucional da Nippon Elevadores.

## Onde colocar os arquivos

Coloque os documentos que devem ser consultados pelo RAG em:

- `knowledge-base/source/`

Formatos suportados no MVP:

- `.docx`
- `.txt`
- `.md`

## Como funciona

- o servico le os arquivos do diretorio `source`
- quebra o conteudo em trechos menores
- recupera os trechos mais relevantes para a pergunta
- usa OpenAI, via `OPENAI_API_KEY` e `OPENAI_MODEL`, para gerar uma resposta curta
- se nao houver contexto suficiente, devolve `found = false`

## Persistencia local

Arquivos auxiliares do indice sao gravados em:

- `knowledge-base/index/`
