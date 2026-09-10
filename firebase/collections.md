# Firestore — modelo de dados (espelho do bot)

Firestore não tem schema. Estas são as coleções que o `sync_agent.py` grava.
Tudo é **espelho** dos arquivos locais do bot — a fonte da verdade continua
sendo o bot.

## `offers/{id}` — ← `data/detected_offers.jsonl`
`id` = sha1(`platform` | `product_id` | `detected_at` | `source_message_id`)

| campo | tipo | origem |
|---|---|---|
| `platform` | string | `amazon` \| `mercadolivre` |
| `product_id` | string | ASIN ou MLBxxxx |
| `source_chat_id` | number | id do grupo de origem |
| `source_name` | string | nome/ID da fonte (hoje vem o ID numérico — bug do bot) |
| `original_url` | string | link como veio no grupo |
| `affiliate_url` | string \| null | link de afiliado gerado |
| `has_photo` | bool | tinha foto anexada |
| `headline` | string | 1ª linha da mensagem de origem |
| `original_message` | string | texto completo |
| `detected_at` | string ISO | ordena por aqui (`orderBy('detected_at','desc')`) |

## `publications/{id}` — ← `data/publications.jsonl`
`id` = sha1(`platform` | `product_id` | `destination` | `published_at`)

| campo | tipo |
|---|---|
| `platform`, `product_id` | string |
| `destination` | `telegram` \| `whatsapp` |
| `destination_id` | string (`@promo_ofertas01` / `Melhores Promo 01`) |
| `status` | `pending` \| `success` \| `error` \| `ignored` \| `skipped` |
| `error_message` | string \| null |
| `headline` | string |
| `published_at` | string ISO |

## `queue_items/{id}` — ← `data/publish_queue.json`
Reescrita a cada ciclo (some quando a oferta é publicada).
`id` = sha1(`platform` | `product_id`)

`position`, `platform`, `product_id`, `original_url`, `affiliate_url`, `headline`, `has_photo`

## `status/singleton` — derivado (1 documento só)

| campo | significado |
|---|---|
| `worker_last_seen` / `worker_state` | maior mtime dos arquivos do bot · `ok` \| `sem_sinal` |
| `last_capture_at` / `last_publish_at` | última captura / última publicação com sucesso |
| `telegram_state` / `whatsapp_state` | pela última publicação de cada destino · `ok` \| `atencao` \| `sem_dados` |
| `ml_state` | `desconhecido` (sinal fino exige heartbeat no bot — fase futura, com aprovação) |
| `captured_today` / `published_today` | contagem do dia (Brasília) |
| `queue_size` | itens em `publish_queue.json` |
| `errors_7d` | publicações com `status=error` nos últimos 7 dias |
| `synced_at` | quando o sync agent atualizou |

## `source_groups/{chatId}` — contagem por grupo

`chat_id`, `config_name` (nome esperado do `config/sources.json`, por ordem),
`captured_total`, `last_capture_at`, `active`

---

## Limites do plano free (Spark) — o que respeitar no painel

- **50k leituras/dia.** O painel deve usar `limit(50)` nos listeners de
  `offers` e `publications` — nunca escutar a coleção inteira (3,5k docs =
  3,5k leituras num attach só).
- **20k escritas/dia.** Backfill inicial ≈ 6k (uma vez). Regime normal ≈ 1–2k/dia.
- Storage 1 GiB — folgadíssimo.
