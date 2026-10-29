# Checkpoint: CRM e automação WhatsApp

Este arquivo registra o trabalho pausado nesta branch. O histórico detalhado que existia
antes do checkpoint não estava mais no diretório quando este resumo foi preparado.

## Estado do código

- Configurações de empresa, marca, mensagens, funil e WhatsApp foram adicionadas ao portal.
- Há uma fila de abordagens no banco, worker PHP e conector Node.js com Baileys e QR code.
- O fluxo previsto é saudação, espera de resposta, mensagem contextual e atendimento manual.
- Envios incertos não devem ser repetidos automaticamente; tentativas contam antes do envio.
- O conector exige processo contínuo e disco persistente para sessão e fila SQLite.
- Os testes anteriores usaram transporte simulado; não houve validação de envio real.

## Banco e implantação

- As migrations `20261029140000_WhatsAppOutreach`,
  `20261029150000_BusinessSettings` e `20261029160000_WhatsAppSendAttempts`
  foram aplicadas no Neon na etapa anterior.
- Na conferência anterior havia 372 leads e 507 interações, com fila e tentativas vazias.
  Esses números são históricos e não representam uma consulta atual.
- Antes das migrations, produção estava em `20261026130000`. Um backup PostgreSQL foi
  restaurado em cópia local para testar as migrations antes de aplicá-las no Neon.
- Empresa e mensagens foram comparadas com o backup e permaneceram iguais.
- Na última execução registrada, passaram 52 testes e 163 asserções do backend e
  6 testes do conector. Login, gravação das quatro seções de configuração e consulta
  de `/api/whatsapp/options` passaram no navegador com cópia local do PostgreSQL.
- A verificação de estilo PHP ainda apresentava problemas e avisos.
- O código desta branch é um checkpoint, não um deploy validado.
- O backup PostgreSQL anterior foi criado em
  `C:\Users\User\AppData\Local\Temp\opencode\crm-backup-20261029.dump`.
  Confirmar sua
  existência e guardá-lo em local durável, restrito e fora do Git.
- Rotacionar a credencial Neon anteriormente exposta e usar novo token do conector.

## Para retomar

1. Rever a arquitetura antes de ativar envios. Baileys não roda de forma confiável como
   função efêmera da Vercel; precisa de processo contínuo e sessão persistente.
2. Se a exigência for usar apenas Vercel e Neon, avaliar Neon Functions agendadas com a
   API oficial da Meta. Essa escolha exige substituir o conector e adaptar o fluxo às
   regras e aos preços das mensagens iniciadas pela empresa.
3. Rodar testes, revisar estilo PHP e validar com um contato que autorizou o teste.
4. Conferir estado atual do Neon e dos serviços antes de qualquer operação.

Consulte `whatsapp-connector/README.md` para a operação da implementação nesta branch.
