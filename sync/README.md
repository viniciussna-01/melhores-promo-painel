# sync_agent — espelho do bot para o Firebase (Fase 2)

Processo **separado** que deixa o painel em tempo real **sem tocar no bot**.

## Garantia de "não altera o sistema"

O `sync_agent.py`:

- **não** importa nenhum módulo do bot (`worker.py`, `publishers/`, `services/`…);
- abre os arquivos do bot **só em leitura** (`open(..., "rb")` / `os.stat`);
- os únicos arquivos que ele toca:
  | arquivo | modo |
  |---|---|
  | `data/detected_offers.jsonl` | leitura |
  | `data/publications.jsonl` | leitura |
  | `data/publish_queue.json` | leitura |
  | `affiliate_bot_session.session` | só `os.stat` (mtime) |
  | `config/sources.json` | leitura |
  | `sync/.sync_state.json` | leitura/escrita — **arquivo próprio**, fora da pasta do bot |
- **nunca** trava (`lock`) nenhum arquivo — a leitura tolera o bot estar no meio de um `append`;
- se o Firebase cair ou este processo morrer, **o bot não percebe** (processos separados, sem lock compartilhado).

Para desligar: `Ctrl+C`. O bot continua rodando.

## Configurar o Firebase (uma vez)

1. **console.firebase.google.com** → *Adicionar projeto* (nome: `melhores-promo`).
   Pode desativar o Google Analytics.
2. **Build → Firestore Database → Criar banco de dados** → modo **produção** →
   região `southamerica-east1` (São Paulo).
3. Aba **Regras** → cole o conteúdo de `firebase/firestore.rules` → *Publicar*.
4. **Authentication → Começar → Email/senha** (ative só esse) →
   aba **Users → Adicionar usuário** → seu e-mail + uma senha.
   (não há tela de cadastro no painel, então só esse usuário entra.)
5. **⚙ Configurações do projeto → Contas de serviço →
   Gerar nova chave privada** → salve o `.json` como
   `sync/serviceAccountKey.json` (já está no `.gitignore`).
6. Ainda em *Configurações do projeto → Geral → Seus apps → Web (</>)* →
   registre um app → **copie o objeto `firebaseConfig`** (apiKey, authDomain,
   projectId…). Isso é do **painel** (Fase 3), não é secreto — me manda quando
   formos montar o Next.js.

## Rodar o sync

Num terminal **diferente** do `worker.py`:

```bash
cd melhores-promo-painel/sync
pip install -r requirements.txt
copy .env.example .env
# edite o .env: caminho do serviceAccountKey.json + caminho do data/ do bot
python sync_agent.py
```

Primeira execução: carga inicial de todo o histórico (~6k documentos, uma vez).
Depois só envia o que é novo, a cada `SYNC_INTERVAL_SECONDS` (padrão 2s).

## O que fica em tempo real (~2–3 s)

capturadas · fila · publicadas por destino (Telegram/WhatsApp) com status ·
erros (7 dias) · saúde (worker vivo por mtime, última captura/publicação,
Telegram/WhatsApp ok pela última publicação) · contagem por grupo.

## O que **não** dá em tempo real (ainda)

O bot só grava no disco quando a oferta **já tem link e entrou na fila** — os
passos finos ("processando", "link sendo alterado") não existem em arquivo, e
não há um pulso explícito do worker nem sinal direto do Mercado Livre/Chrome.

Para isso o bot teria que **emitir eventos** (um `status.json` a cada 30 s + uma
linha por transição). É uma mudança **pequena e aditiva** (escreve um arquivo
novo, não altera nenhum fluxo), mas só entra **com sua aprovação explícita**,
numa fase à parte.

## Próximo passo (Fase 3)

Painel **Next.js na Vercel** lendo o Firestore via `onSnapshot` (atualiza sem
refresh) + login pelo Firebase Auth. O Artifact atual serviu só para validar o
formato — ele não fala com backend externo (sandbox), então o painel de verdade
vira um app publicado.
