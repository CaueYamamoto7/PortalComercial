# WhatsApp: operação do Portal Comercial

## Arquitetura

O portal CakePHP mantém a fila no seu banco. Um worker PHP consulta o conector Node.js,
importa eventos e executa tarefas persistentes. O conector usa Baileys por dispositivo
vinculado e mantém sessão, eventos pendentes e identificadores de envio em disco.
O navegador conversa apenas com a API autenticada do portal; token e credenciais nunca
são enviados ao front-end. Somente administradores podem visualizar o QR e vincular a conta.

Esta é uma integração **não oficial**, sem garantia contra bloqueios. Espera de 1–6
minutos e mensagens personalizadas não oferecem proteção contra restrições. Não há
cobrança de API Meta; infraestrutura e eventuais limites da IA continuam aplicáveis.

## Pré-requisitos

- Node.js 24 LTS (mínimo 22.13), PHP e dependências do backend instalados.
- Uma máquina sempre ligada para o conector e o worker. Não execute esses processos
  como funções efêmeras da Vercel.
- Worker e portal apontando para **o mesmo banco**. Se o portal está hospedado,
  o worker precisa acessar seu PostgreSQL. Um SQLite local distinto não funciona.
- Uma única conta WhatsApp comercial para esta instalação. Não troque o número
  enquanto houver tarefas ativas. Histórico antigo não é importado como novas respostas:
  revise contatos anteriores antes de iniciar a primeira campanha.

## Instalação

1. Faça um backup restaurável do banco e confirme que o código novo e as três
   migrations de WhatsApp/configuração serão implantados juntos. No diretório
   `backend`, aplique as migrations e limpe o cache do schema:

   ```sh
   php bin/cake.php migrations migrate
   php bin/cake.php schema_cache clear
   ```

2. Gere um segredo (não reutilize o salt da aplicação):

   ```sh
   php -r "echo bin2hex(random_bytes(32));"
   ```

3. Configure no **ambiente do backend e do worker**:

   ```text
   WHATSAPP_CONNECTOR_URL=http://127.0.0.1:3100
   WHATSAPP_CONNECTOR_TOKEN=<segredo gerado>
   GROQ_API_KEY=<opcional>
   GROQ_MODEL=<modelo disponível na sua conta gratuita>
   ```

   O backend não carrega automaticamente o `.env` da raiz. Exporte as variáveis no
   sistema/serviço ou configure-as no provedor de hospedagem, como já ocorre com DATABASE_URL.
   `127.0.0.1` só funciona para processos na mesma máquina; configure um endereço privado
   alcançável pelo portal e pelo worker quando estiverem separados. Para acesso pela
   rede, use HTTPS com certificado válido e restrinja o acesso ao conector.

4. No diretório `whatsapp-connector`, copie `.env.example` para `.env`, configure o
   mesmo segredo e execute:

   ```sh
   npm ci --ignore-scripts
   npm start
   ```

   O serviço escuta apenas em `127.0.0.1` por padrão. `HOST`, `PORT` e `DATA_DIR` são
   configuráveis. O Dockerfile opcional exige volume persistente em `/app/data`; não
   publique a porta diretamente na internet.

5. Em outro processo, no diretório `backend`:

   ```sh
   php bin/cake.php whats_app_worker
   ```

   Para diagnóstico de um único ciclo: `php bin/cake.php whats_app_worker --once`.
   Em produção, use um supervisor de processos com reinicialização automática para
   ambos os serviços. A interface mostra o heartbeat do worker e a conexão separadamente.

6. Entre como administrador em **Mensagens → Conectar / gerar QR code**. No celular,
   abra **WhatsApp → Aparelhos conectados → Conectar aparelho** e escaneie o QR.

7. Valide primeiro com um contato autorizado: saudação, resposta, prévia, temporizador,
   segunda mensagem, histórico e intervenção manual. O QR e essa validação dependem
   do titular da conta; testes automatizados usam transporte simulado.

## Fluxo implementado

- Seleção explícita de até 200 leads por inclusão, com busca e filtro por etapa.
- Registrar a origem/data da autorização junto com o responsável e o horário.
- Saudação fixa `Olá <primeiro nome>, tudo bem?` (sem nome: `Olá, tudo bem?`).
- Somente após confirmação de envio: etapa **Contatado**, fila **Aguardando**.
- Primeira resposta nova: agenda uma única mensagem para 60–360 segundos depois.
- Mensagens adicionais atualizam o contexto, sem duplicar o agendamento.
- A prévia pode ser editada enquanto estiver na fila **Responderam**.
- Após a segunda mensagem: controle **manual**, com contadores e timeline sincronizados.
- Clientes sem resposta permanecem aguardando, sem follow-up automático.
- Quem já respondeu ou está em Proposta/etapas posteriores fica no atendimento manual.
- Recusa, mídia sem texto interpretável, falta de contexto, mudança de etapa e intervenção
  do operador interrompem a automação. A detecção por palavras não substitui leitura humana.
- Um agendamento atrasado em mais de 15 minutos é encaminhado ao operador.
- Horário comercial, fuso, intervalo e limite diário são configurados em Mensagens.
  Cada tentativa conta antes da chamada ao conector, inclusive em caso de timeout.
  A contagem é compartilhada pelos workers no banco; não inclui envios feitos pelo
  aplicativo do WhatsApp. O intervalo é respeitado também na virada do dia. Fora da
  janela, os eventos continuam sendo processados; mensagens contextuais que vencerem
  durante a espera passam para atendimento manual, sem reenvio automático.
- Um contato/telefone não pode receber uma nova abordagem automática pela mesma instalação;
  cancelamento não o libera para novo disparo.
- O envio só é considerado concluído após confirmação do WhatsApp (ACK do servidor,
  entrega ou leitura). O retorno inicial apenas registra que a mensagem foi submetida.
- Número inexistente, contato consigo mesmo e dois formatos do mesmo telefone são recusados
  antes do envio. Envio com resultado incerto nunca é repetido automaticamente.
- Envios da versão anterior, sem confirmação, são movidos para atendimento manual com aviso
  em vez de serem considerados entregues.

**Assumir atendimento** cancela as tarefas pendentes. A abertura de uma mensagem individual
no drawer também assume o atendimento e abre `wa.me` com o texto preenchido. A abertura não
é registrada como envio. Existe uma janela inevitável quando o envio já foi entregue ao
transporte: o cancelamento não recolhe mensagens que já saíram.

## IA e fallback

Sem chave/modelo configurados, usa o texto aprovado, com apresentação da AssinaSoft e
substituição de `{{nome}}`, `{{empresa}}`, `{{sistema_interesse}}`. Perguntas sem IA vão
para atendimento manual. Com Groq, envia objetivo, sistemas e observações relevantes,
além da resposta. Não envia telefone/e-mail. Configure os controles de retenção da conta
e mantenha dados sensíveis fora das observações enviadas. Não há ativação automática de plano pago.
Se a IA falhar, usa o fallback aprovado ou transfere para humano; não perde a tarefa.

## Persistência e diagnóstico

- `wa_outreach`: estado da abordagem, autorização, textos, horários e responsável.
- `wa_events`: identificadores processados para deduplicação.
- `wa_runtime`: lease global e heartbeat do worker.
- `wa_send_attempts`: tentativas registradas antes do envio, inclusive incertas.
  Não apague esses registros para contornar os limites.
- `data/auth`: credenciais de dispositivo vinculado. Restrinja as permissões ao usuário
  do serviço e use volume/disco criptografado. Não publique, copie para o front ou versione.
- `data/queue.sqlite`: eventos ainda não confirmados, intervenções e resultados de envio.
  Preserve esse volume nos reinícios. Não execute dois conectores sobre a mesma sessão.

Envios de resultado incerto **não são repetidos automaticamente**. O worker tenta
reconciliar recibos conhecidos. Quando não houver confirmação, o operador deve verificar
o aplicativo e assumir o contato. O painel registra confirmação de envio, não promete
confirmação de leitura/entrega. Não altere uma tarefa incerta para `queued` manualmente.

O conector ignora grupos, reações, eventos de protocolo e histórico sincronizado.
Identificadores LID são resolvidos pelo mapeamento da sessão quando disponível. Um contato
sem telefone resolvido não é associado por aproximação; verifique a sincronização no teste real.

## Testes

```sh
# Em backend
php vendor/bin/phpunit
# Em whatsapp-connector
npm test
```

Incluem deduplicação, persistência após reinício, intervenção manual, recusas, temporizador,
transição para Proposta e reconciliação sem reenvio. Nenhum teste dispara mensagens reais.
