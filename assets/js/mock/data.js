/* ==========================================================================
   Painel Comercial — Dados de demonstração
   Empresa: AssinaSoft
   ========================================================================== */

(function (Painel) {
  "use strict";

  var u = Painel.util;

  function hora(dias, h, m) {
    return u.diasAtras(dias, h, m);
  }

  function futuro(dias, h, m) {
    return u.diasFrente(dias, h, m);
  }

  function depoisDe(data, horas) {
    var d = new Date(data);
    d.setTime(d.getTime() + horas * 3600000);
    if (d > new Date()) d = new Date(Date.now() - 30 * 60000);
    return d.toISOString();
  }

  function textoMensagem(lead) {
    var sistemasLead = (lead.sistemaIds || []).map(function (id) {
      var s = sistemas.filter(function (x) { return x.id === id; })[0];
      return s ? s.nome : "";
    }).filter(Boolean).join(" e ");
    return "Olá, " + u.primeiroNome(lead.nome) + "! Sou " + lead.responsavel + ", da AssinaSoft. " +
      (sistemasLead ? "Vi seu interesse em " + sistemasLead + " e queria entender melhor o seu cenário. " : "") +
      "Podemos conversar por aqui?";
  }

  /* Catálogo -------------------------------------------------------------- */

  var sistemas = [
    { id: "sis_pdf", nome: "AssinaPDF", descricao: "Assinatura digital e gestão de documentos PDF.", cor: "#0B6B57", ativo: true },
    { id: "sis_dns", nome: "AssinaDNS", descricao: "Gestão, proteção e monitoramento de DNS.", cor: "#2563EB", ativo: true },
    { id: "sis_seg", nome: "ConforSeg", descricao: "Conformidade, segurança da informação e auditoria.", cor: "#B45309", ativo: true }
  ];

  var etapas = [
    { id: "et_novo", nome: "Novo", cor: "#64748B", tipo: "aberto", ordem: 0 },
    { id: "et_contatado", nome: "Contatado", cor: "#2563EB", tipo: "aberto", ordem: 1 },
    { id: "et_qualificado", nome: "Qualificado", cor: "#7C3AED", tipo: "aberto", ordem: 2 },
    { id: "et_proposta", nome: "Proposta", cor: "#D97706", tipo: "aberto", ordem: 3 },
    { id: "et_negociacao", nome: "Negociação", cor: "#DB2777", tipo: "aberto", ordem: 4 },
    { id: "et_ganho", nome: "Ganho", cor: "#059669", tipo: "ganho", ordem: 5 },
    { id: "et_perdido", nome: "Perdido", cor: "#DC2626", tipo: "perdido", ordem: 6 }
  ];

  var origens = [
    { id: "org_feira", nome: "Feira / evento", ativo: true },
    { id: "org_indicacao", nome: "Indicação", ativo: true },
    { id: "org_site", nome: "Site", ativo: true },
    { id: "org_linkedin", nome: "LinkedIn", ativo: true },
    { id: "org_prospeccao", nome: "Prospecção ativa", ativo: true },
    { id: "org_evento", nome: "Evento próprio", ativo: true },
    { id: "org_outro", nome: "Outro", ativo: true }
  ];

  var equipe = [
    { id: "us_001", nome: "Marina Costa", email: "marina@assinasoft.com.br", perfil: "Administradora", status: "ativo", iniciais: "MC" },
    { id: "us_002", nome: "Rafael Nunes", email: "rafael@assinasoft.com.br", perfil: "Consultor comercial", status: "ativo", iniciais: "RN" },
    { id: "us_003", nome: "Camila Rocha", email: "camila@assinasoft.com.br", perfil: "Consultora comercial", status: "ativo", iniciais: "CR" }
  ];

  /* Leads ----------------------------------------------------------------- */

  var base = [
    ["Ana Beatriz Ferreira", "Aurora Studio", "Diretora de Marketing", "5511998742101", "ana@aurorastudio.com.br", "São Paulo", "SP", "org_feira", "Feira do Empreendedor 2026", ["sis_pdf"], "nao", "", "et_qualificado", "alta", "Marina Costa", futuro(1, 10, 0), hora(2, 14, 30), "Interesse em assinatura digital para contratos de campanhas. Já usa assinatura manual.", ["Feira 2026", "Quente"], false, 34, ""],
    ["Carlos Eduardo Lima", "Vertex Logística", "Gerente Comercial", "5511987654321", "carlos@vertexlog.com.br", "Campinas", "SP", "org_indicacao", "Indicação de cliente AssinaPDF", ["sis_dns"], "sim", "Monitoramento de DNS do registrador", "et_proposta", "alta", "Rafael Nunes", futuro(0, 15, 0), hora(1, 11, 0), "Proposta enviada para 3 domínios. Precisa de aprovação do financeiro.", ["Proposta", "B2B"], false, 61, ""],
    ["Mariana Souza", "Casa Nativa", "Proprietária", "5521996457890", "mariana@casanativa.com.br", "Rio de Janeiro", "RJ", "org_site", "Formulário do site", ["sis_seg"], "nao_informado", "", "et_contatado", "media", "Camila Rocha", futuro(2, 9, 30), hora(4, 16, 10), "Baixou o material sobre conformidade e respondeu ao primeiro contato.", ["Inbound"], false, 28, ""],
    ["Rafael Andrade", "Andrade & Co.", "Sócio", "5531988776655", "rafael@andradeco.com.br", "Belo Horizonte", "MG", "org_feira", "Expo B2B 2026", ["sis_pdf", "sis_dns"], "sim", "Assinatura em outro fornecedor", "et_negociacao", "alta", "Marina Costa", futuro(0, 11, 30), hora(1, 17, 0), "Comparando custo total com fornecedor atual. Pediu proposta para 2 anos.", ["Negociação", "Multi-sistema"], false, 72, ""],
    ["Juliana Castro", "Bloom Cosméticos", "Head de E-commerce", "5541998221144", "juliana@bloom.com.br", "Curitiba", "PR", "org_linkedin", "Campanha LinkedIn", ["sis_pdf"], "nao", "", "et_ganho", "alta", "Rafael Nunes", null, hora(3, 9, 45), "Contrato fechado para AssinaPDF. Onboarding previsto para a próxima semana.", ["Cliente", "E-commerce"], false, 88, ""],
    ["Pedro Henrique Martins", "Martins Imóveis", "Corretor", "5551997432567", "pedro@martinsimoveis.com.br", "Porto Alegre", "RS", "org_feira", "Feira do Empreendedor 2026", ["sis_dns"], "nao", "", "et_novo", "media", "Camila Rocha", futuro(1, 14, 0), null, "Coletou o contato no estande. Interesse em proteger os domínios da imobiliária.", ["Feira 2026"], false, 3, ""],
    ["Camila Rocha", "Rocha Odontologia", "Administradora", "5561987665544", "camila@rochaodonto.com.br", "Brasília", "DF", "org_indicacao", "Indicação da Clínica Bem Viver", ["sis_seg"], "nao", "", "et_contatado", "media", "Marina Costa", futuro(3, 9, 0), hora(5, 8, 30), "Aguardando retorno sobre adequação à LGPD na clínica.", ["Saúde", "Indicação"], false, 22, ""],
    ["Bruno Carvalho", "NCB Tecnologia", "CTO", "5511977223344", "bruno@ncb.tech", "São Paulo", "SP", "org_site", "Solicitação de demonstração", ["sis_pdf", "sis_seg"], "sim", "Ferramenta interna de assinatura", "et_qualificado", "alta", "Rafael Nunes", futuro(1, 16, 0), hora(2, 10, 0), "Quer integrar assinatura via API ao produto dele. Necessário avaliar requisitos técnicos.", ["API", "Tecnologia"], false, 19, ""],
    ["Larissa Mendes", "Empório Verde", "Gerente de Loja", "5513996112233", "larissa@emporioverde.com.br", "Santos", "SP", "org_feira", "Feira do Empreendedor 2026", ["sis_pdf"], "nao_informado", "", "et_proposta", "media", "Camila Rocha", futuro(2, 11, 0), hora(3, 9, 20), "Proposta de assinatura para contratos de fornecedores enviada por e-mail.", ["Feira 2026", "Varejo"], false, 31, ""],
    ["Thiago Nogueira", "Nogueira Advocacia", "Advogado", "5511999445566", "thiago@nogueiraadv.com.br", "São Paulo", "SP", "org_prospeccao", "Lista de prospecção", ["sis_pdf"], "sim", "Assinatura em outro fornecedor", "et_perdido", "baixa", "Rafael Nunes", null, hora(18, 14, 0), "Optou por renovar com o fornecedor atual. Retomar contato no próximo ano.", ["Perdido"], false, 55, "Renovou com fornecedor atual"],
    ["Fernanda Alves", "Studio F. Alves", "Arquiteta", "5521988334455", "fernanda@studiofalves.com.br", "Niterói", "RJ", "org_feira", "Expo B2B 2026", ["sis_seg"], "nao_informado", "", "et_novo", "baixa", "Camila Rocha", futuro(5, 10, 0), null, "Contato coletado no estande. Pediu material sobre conformidade.", ["Feira 2026"], false, 4, ""],
    ["Gustavo Ribeiro", "Ribeiro Fitness", "Proprietário", "5531991223344", "gustavo@ribeirofitness.com.br", "Uberlândia", "MG", "org_indicacao", "Indicação de Carlos Lima", ["sis_dns"], "nao", "", "et_contatado", "media", "Marina Costa", futuro(4, 15, 0), hora(7, 18, 5), "Interesse em migrar os domínios para um DNS gerenciado.", ["Indicação"], false, 25, ""],
    ["Patrícia Gomes", "Gomes & Filhos", "Diretora Financeira", "5541988556677", "patricia@gomesfilhos.com.br", "Londrina", "PR", "org_feira", "Expo B2B 2026", ["sis_pdf", "sis_dns"], "nao", "", "et_ganho", "alta", "Rafael Nunes", null, hora(9, 10, 30), "Fechou pacote AssinaPDF + AssinaDNS para 12 meses.", ["Cliente", "Pacote"], false, 96, ""],
    ["Diego Fernandes", "DF Audiovisual", "Produtor", "5551988667799", "diego@dfaudiovisual.com", "Porto Alegre", "RS", "org_linkedin", "Campanha LinkedIn", ["sis_pdf"], "nao_informado", "", "et_perdido", "baixa", "Camila Rocha", null, hora(35, 11, 0), "Não respondeu aos três contatos. Arquivado por falta de retorno.", ["Sem retorno"], true, 70, "Sem retorno após 3 tentativas"],
    ["Isabela Moreira", "Moreira Consultoria", "Consultora", "5561999887766", "isabela@moreiraconsult.com.br", "Brasília", "DF", "org_site", "Formulário do site", ["sis_seg"], "sim", "Consultoria externa de compliance", "et_qualificado", "media", "Marina Costa", futuro(1, 9, 30), hora(3, 16, 0), "Precisa consolidar evidências de auditoria. Reunião técnica realizada.", ["Consultoria"], false, 17, ""],
    ["Lucas Teixeira", "Teixeira Pneus", "Gerente", "5511977332211", "lucas@teixeirapneus.com.br", "Guarulhos", "SP", "org_feira", "Feira do Empreendedor 2026", ["sis_dns"], "sim", "DNS do provedor de hospedagem", "et_proposta", "media", "Camila Rocha", futuro(3, 14, 40), hora(4, 14, 40), "Proposta de migração de DNS enviada. Aguardando validação técnica.", ["Feira 2026", "Varejo"], false, 29, ""],
    ["Renata Barros", "Barros Educação", "Coordenadora", "5521998776655", "renata@barroseducacao.com.br", "Rio de Janeiro", "RJ", "org_indicacao", "Indicação de escola parceira", ["sis_pdf"], "nao", "", "et_negociacao", "alta", "Marina Costa", futuro(0, 9, 0), hora(1, 8, 20), "Negociando assinatura de documentos acadêmicos para duas unidades.", ["Educação", "Negociação"], false, 48, ""],
    ["Felipe Araújo", "Araújo Café", "Sócio", "5531988112233", "felipe@araujocafe.com.br", "Belo Horizonte", "MG", "org_feira", "Expo B2B 2026", ["sis_pdf", "sis_seg"], "nao_informado", "", "et_novo", "media", "Rafael Nunes", futuro(2, 16, 0), null, "Coletou material sobre assinatura e conformidade. Primeiro contato pendente.", ["Feira 2026", "Alimentação"], false, 2, ""],
    ["Vanessa Pires", "Pires Moda", "Gestora", "5541997123456", "vanessa@piresmoda.com.br", "Curitiba", "PR", "org_site", "Formulário do site", ["sis_pdf"], "nao", "", "et_contatado", "media", "Camila Rocha", futuro(3, 10, 15), hora(6, 10, 15), "Respondeu ao primeiro contato. Vai avaliar com o time jurídico.", ["Varejo"], false, 20, ""],
    ["André Santos", "Santos Engenharia", "Engenheiro", "5551996554433", "andre@santoseng.com.br", "Canoas", "RS", "org_prospeccao", "Lista de prospecção", ["sis_dns"], "sim", "DNS gerenciado pelo TI interno", "et_perdido", "baixa", "Rafael Nunes", null, hora(44, 10, 0), "Sem aderência no momento. Contato encerrado.", ["Perdido"], false, 80, "Sem aderência no momento"],
    ["Beatriz Nunes", "Clínica Bem Viver", "Gestora", "5511988220011", "beatriz@bemviver.com.br", "São Paulo", "SP", "org_indicacao", "Indicação de consultório parceiro", ["sis_seg"], "nao", "", "et_ganho", "alta", "Marina Costa", null, hora(6, 8, 15), "Fechou ConforSeg para adequação à LGPD. Cliente ativo.", ["Cliente", "Saúde"], false, 65, ""],
    ["Marcos Vinícius Almeida", "Almeida Distribuidora", "Comprador", "5531977445533", "marcos@almeidadist.com.br", "Juiz de Fora", "MG", "org_feira", "Feira do Empreendedor 2026", ["sis_dns", "sis_pdf"], "sim", "Assinatura e DNS em fornecedores separados", "et_proposta", "media", "Rafael Nunes", futuro(4, 11, 25), hora(5, 11, 25), "Quer unificar fornecedores. Proposta combinada enviada.", ["Feira 2026", "Pacote"], false, 38, ""],
    ["Carolina Dias", "Dias Arquitetura", "Sócia", "5521987556644", "carolina@diasarq.com.br", "Rio de Janeiro", "RJ", "org_linkedin", "Campanha LinkedIn", ["sis_pdf"], "nao", "", "et_qualificado", "media", "Camila Rocha", futuro(1, 12, 10), hora(2, 12, 10), "Demonstração realizada. Interesse em assinar contratos de projeto.", ["Arquitetura"], false, 15, ""],
    ["Rodrigo Castro", "Castro Eventos", "Diretor", "5511996332244", "rodrigo@castroeventos.com.br", "São Paulo", "SP", "org_feira", "Expo B2B 2026", ["sis_seg"], "nao_informado", "", "et_novo", "baixa", "Marina Costa", futuro(6, 15, 0), null, "Coletou contato no estande. Interesse em conformidade para eventos corporativos.", ["Feira 2026"], false, 1, ""],
    ["Amanda Silva", "Silva Pet", "Proprietária", "5511988223322", "amanda@silvapet.com.br", "São Paulo", "SP", "org_site", "Formulário do site", ["sis_pdf"], "nao", "", "et_contatado", "media", "Rafael Nunes", futuro(2, 10, 0), hora(8, 9, 40), "Pediu exemplo de contrato de assinatura para fornecedores.", ["Pet", "Inbound"], false, 23, ""],
    ["Eduardo Ramos", "Ramos Contabilidade", "Sócio", "5511997112233", "eduardo@ramoscont.com.br", "São Paulo", "SP", "org_indicacao", "Indicação de Patrícia Gomes", ["sis_seg"], "sim", "Processo manual em planilhas", "et_proposta", "alta", "Camila Rocha", futuro(1, 17, 0), hora(2, 17, 0), "Proposta de ConforSeg enviada. Interesse em reduzir risco de auditoria.", ["Indicação", "Contabilidade"], false, 26, ""],
    ["Luiza Martins", "Martins Consultoria", "Diretora", "5521996445566", "luiza@martinsconsult.com.br", "Rio de Janeiro", "RJ", "org_evento", "AssinaSoft Summit 2026", ["sis_dns"], "nao", "", "et_negociacao", "alta", "Marina Costa", futuro(0, 14, 0), hora(1, 14, 30), "Negociando contrato anual de AssinaDNS para clientes da consultoria.", ["Summit", "Negociação"], false, 41, ""],
    ["Vinícius Costa", "Costa Solar", "Diretor de Operações", "5541997888999", "vinicius@costasolar.com.br", "Curitiba", "PR", "org_feira", "Feira do Empreendedor 2026", ["sis_pdf"], "nao", "", "et_novo", "alta", "Rafael Nunes", futuro(1, 9, 0), null, "Lead quente da feira. Precisa assinar contratos de instalação em campo.", ["Feira 2026", "Quente"], false, 1, ""],
    ["Helena Duarte", "Duarte Educação", "Mantenedora", "5561997123456", "helena@duarteeducacao.com.br", "Brasília", "DF", "org_linkedin", "Campanha LinkedIn", ["sis_pdf", "sis_seg"], "nao", "", "et_ganho", "alta", "Camila Rocha", null, hora(12, 10, 0), "Fechou pacote para três escolas. Início do onboarding concluído.", ["Cliente", "Educação", "Pacote"], false, 74, ""],
    ["Sérgio Almeida", "Almeida Log", "Gerente de TI", "5511996554433", "sergio@almeidalog.com.br", "São Paulo", "SP", "org_prospeccao", "Lista de prospecção", ["sis_dns"], "sim", "DNS do provedor de nuvem", "et_negociacao", "media", "Rafael Nunes", futuro(0, 16, 30), hora(2, 16, 0), "Avaliando migração de 40 domínios. Pediu proposta por volume.", ["Negociação", "B2B"], false, 39, ""],
    ["Priscila Nunes", "Nunes Saúde", "Diretora Clínica", "5511987332211", "priscila@nunessaude.com.br", "São Paulo", "SP", "org_feira", "Expo B2B 2026", ["sis_seg"], "nao_informado", "", "et_qualificado", "alta", "Marina Costa", futuro(2, 8, 30), hora(3, 8, 30), "Precisa adequar prontuários e contratos. Reunião com jurídico marcada.", ["Saúde", "Feira 2026"], false, 21, ""],
    ["Otávio Lima", "Lima Indústria", "Controller", "5511998224466", "otavio@limaindustria.com.br", "São Paulo", "SP", "org_evento", "AssinaSoft Summit 2026", ["sis_pdf", "sis_dns"], "nao", "", "et_contatado", "media", "Camila Rocha", futuro(5, 11, 0), hora(9, 11, 0), "Primeiro contato feito após o summit. Vai envolver o time de TI.", ["Summit", "Indústria"], false, 30, ""]
  ];

  var leads = base.map(function (r, i) {
    var id = "ld_" + String(i + 1).padStart(3, "0");
    var criadoEm = hora(90 - i * 2.4, 9, 0);
    var atualizadoEm = r[16] || criadoEm;
    return {
      id: id,
      nome: r[0],
      empresa: r[1],
      cargo: r[2],
      telefone: r[3],
      email: r[4],
      cidade: r[5],
      uf: r[6],
      origemId: r[7],
      origemDetalhe: r[8],
      sistemaIds: r[9],
      possuiSistema: r[10],
      sistemaAtual: r[11],
      etapaId: r[12],
      prioridade: r[13],
      responsavel: r[14],
      proximoContato: r[15],
      ultimoContato: r[16],
      observacoes: r[17],
      tags: r[18],
      naoContatar: r[19],
      criadoEm: criadoEm,
      atualizadoEm: atualizadoEm,
      motivoPerda: r[21] || ""
    };
  });

  /* Interações ------------------------------------------------------------ */

  var interacoes = [];
  var contadorInteracao = 1;

  function addInteracao(lead, tipo, titulo, descricao, data, extra) {
    interacoes.push(Object.assign({
      id: "it_" + String(contadorInteracao++).padStart(3, "0"),
      leadId: lead.id,
      tipo: tipo,
      titulo: titulo,
      descricao: descricao,
      data: data,
      usuario: lead.responsavel
    }, extra || {}));
  }

  var indiceEtapa = {};
  etapas.forEach(function (e) { indiceEtapa[e.id] = e.ordem; });

  var ULTIMA_ENTRADA = {
    ld_003: "Oi! Recebi sim. Pode me explicar como funciona a assinatura para os contratos da Casa Nativa?",
    ld_007: "Oi, tudo bem! A clínica precisa se adequar à LGPD. Consegue me enviar um resumo?",
    ld_009: "Recebi a proposta. Consigo avaliar com o financeiro amanhã, pode ser?",
    ld_015: "Gostei da reunião. Consegue me mandar o escopo por escrito para eu validar internamente?",
    ld_019: "Oi! Ainda estou avaliando com o jurídico. Você tem um caso parecido com o nosso?",
    ld_023: "A demonstração foi ótima. Podemos ver os valores para 10 usuários?",
    ld_025: "Oi! Consegue me enviar o exemplo de contrato que comentou?",
    ld_031: "Oi! Consegui falar com o TI. Eles pediram uma proposta para 40 domínios."
  };

  var CONVERSA_ATIVA = {
    ld_001: "Oi, Marina! Tenho interesse sim. Como funciona a assinatura para campanhas?",
    ld_004: "Faz sentido. Consegue revisar a proposta para 2 anos?",
    ld_008: "Legal! Meu time usa API. Vocês têm integração?",
    ld_016: "Perfeito, gostei do escopo. Qual o próximo passo?",
    ld_017: "Oi! Podemos marcar uma conversa na quinta?",
    ld_022: "Fechado, podemos seguir com a proposta combinada.",
    ld_026: "Recebi. Vou validar internamente e te retorno.",
    ld_027: "Oi! O time jurídico pediu alguns ajustes no contrato."
  };

  var RESPOSTAS_CLIENTE = {
    ld_005: "Fechado! Pode enviar o contrato para assinatura.",
    ld_013: "Aprovado. Pode emitir o contrato do pacote.",
    ld_021: "Conseguimos aprovar. Vamos seguir com a implantação.",
    ld_029: "Fechado para as três escolas. Pode iniciar o onboarding."
  };

  var RESPOSTAS_RECUSA = {
    ld_010: "Obrigado, mas vamos continuar com o fornecedor atual.",
    ld_014: "Não temos interesse no momento. Por favor, não envie mais mensagens.",
    ld_020: "Agradecemos o contato, mas não há aderência para o nosso momento."
  };

  leads.forEach(function (lead, i) {
    addInteracao(lead, "nota", "Lead cadastrado", "Contato adicionado ao Painel Comercial a partir de " + (lead.origemDetalhe || "prospecção") + ".", lead.criadoEm);

    var ordem = indiceEtapa[lead.etapaId];
    var base = lead.ultimoContato || lead.criadoEm;
    var enviadaEm = base;

    if (ordem >= 1) {
      addInteracao(lead, "mensagem", "Mensagem enviada pelo WhatsApp", textoMensagem(lead), enviadaEm, { canal: "WhatsApp", direcao: "saida" });
    }

    if (ordem >= 2) {
      addInteracao(lead, "reuniao", "Reunião de qualificação", "Reunião realizada para entender o cenário atual, necessidades e tomada de decisão.", hora(Math.max(1, 10 - i % 5), 15, 0));
    }
    if (ordem >= 3) {
      addInteracao(lead, "nota", "Proposta comercial enviada", "Proposta enviada com escopo, prazo e investimento. Aguardando retorno do lead.", hora(Math.max(1, 6 - i % 4), 10, 30));
    }
    if (ordem >= 4) {
      addInteracao(lead, "nota", "Negociação em andamento", "Lead solicitou ajustes comerciais. Valores e condições em revisão.", hora(2, 16, 0));
    }

    if (ULTIMA_ENTRADA[lead.id]) {
      var entradaEm = depoisDe(enviadaEm, 4);
      addInteracao(lead, "mensagem", "Mensagem recebida pelo WhatsApp", ULTIMA_ENTRADA[lead.id], entradaEm, { canal: "WhatsApp", direcao: "entrada" });
      lead.ultimoContato = entradaEm;
      lead.atualizadoEm = entradaEm;
    }

    if (CONVERSA_ATIVA[lead.id]) {
      var recebidaEm = depoisDe(enviadaEm, 4);
      addInteracao(lead, "mensagem", "Mensagem recebida pelo WhatsApp", CONVERSA_ATIVA[lead.id], recebidaEm, { canal: "WhatsApp", direcao: "entrada" });
      var respondidaEm = depoisDe(recebidaEm, 1);
      addInteracao(lead, "mensagem", "Resposta enviada pelo WhatsApp", "Perfeito! Vou preparar o material e já te envio por aqui. Qualquer dúvida, fico à disposição.", respondidaEm, { canal: "WhatsApp", direcao: "saida" });
      lead.ultimoContato = respondidaEm;
      lead.atualizadoEm = respondidaEm;
    }

    if (RESPOSTAS_CLIENTE[lead.id]) {
      var clienteEm = depoisDe(enviadaEm, 4);
      addInteracao(lead, "mensagem", "Mensagem recebida pelo WhatsApp", RESPOSTAS_CLIENTE[lead.id], clienteEm, { canal: "WhatsApp", direcao: "entrada" });
      var contratoEm = depoisDe(clienteEm, 1);
      addInteracao(lead, "mensagem", "Resposta enviada pelo WhatsApp", "Excelente! Vou encaminhar o contrato e o passo a passo de onboarding.", contratoEm, { canal: "WhatsApp", direcao: "saida" });
      lead.ultimoContato = contratoEm;
      lead.atualizadoEm = contratoEm;
    }

    if (RESPOSTAS_RECUSA[lead.id]) {
      var recusaEm = depoisDe(enviadaEm, 3);
      addInteracao(lead, "mensagem", "Mensagem recebida pelo WhatsApp", RESPOSTAS_RECUSA[lead.id], recusaEm, { canal: "WhatsApp", direcao: "entrada" });
      lead.naoContatar = true;
      lead.motivoPerda = lead.motivoPerda || "Contato recusou a continuidade.";
      lead.ultimoContato = recusaEm;
      lead.atualizadoEm = recusaEm;
    }

    if (lead.etapaId === "et_ganho") {
      addInteracao(lead, "nota", "Negócio ganho", "Contrato fechado. Cliente encaminhado para onboarding.", lead.ultimoContato || hora(5, 10, 0));
    }
    if (lead.etapaId === "et_perdido") {
      addInteracao(lead, "nota", "Oportunidade perdida", lead.motivoPerda || "Oportunidade encerrada.", lead.ultimoContato || hora(20, 10, 0));
    }
  });

  /* Tarefas --------------------------------------------------------------- */

  var tarefas = [];
  var abertos = leads.filter(function (l) { return ["et_ganho", "et_perdido"].indexOf(l.etapaId) === -1; });

  abertos.forEach(function (lead, i) {
    if (!lead.proximoContato) return;
    var titulo = lead.etapaId === "et_proposta"
      ? "Acompanhar proposta de " + lead.empresa
      : lead.etapaId === "et_novo"
        ? "Fazer primeiro contato com " + u.primeiroNome(lead.nome)
        : "Retomar conversa com " + u.primeiroNome(lead.nome);
    tarefas.push({
      id: "tk_" + String(i + 1).padStart(3, "0"),
      leadId: lead.id,
      titulo: titulo,
      tipo: i % 3 === 0 ? "ligacao" : i % 3 === 1 ? "mensagem" : "reuniao",
      data: lead.proximoContato,
      prioridade: lead.prioridade,
      status: "pendente",
      responsavel: lead.responsavel
    });
  });

  tarefas.push({
    id: "tk_900", leadId: "ld_001", titulo: "Enviar estudo de caso AssinaPDF",
    tipo: "mensagem", data: hora(1, 10, 0), prioridade: "alta", status: "concluida", responsavel: "Marina Costa"
  });
  tarefas.push({
    id: "tk_901", leadId: "ld_004", titulo: "Revisar condições da proposta de 2 anos",
    tipo: "nota", data: hora(2, 16, 0), prioridade: "alta", status: "concluida", responsavel: "Marina Costa"
  });

  /* Templates ------------------------------------------------------------- */

  var templates = [
    {
      id: "tp_001", nome: "Primeiro contato — feira", categoria: "Prospecção",
      conteudo: "Olá, {{primeiro_nome}}! Tudo bem?\n\nFoi um prazer conversar com você na {{origem_detalhe}}. Sou {{responsavel}}, da AssinaSoft.\n\nVocê demonstrou interesse em {{sistema_interesse}}. Posso te enviar um resumo rápido de como funciona?\n\nFico à disposição por aqui.",
      atualizadoEm: hora(2, 10, 0), usos: 42
    },
    {
      id: "tp_002", nome: "Apresentação AssinaPDF", categoria: "AssinaPDF",
      conteudo: "Oi, {{primeiro_nome}}!\n\nA AssinaPDF resolve a assinatura digital de contratos e documentos com validade jurídica, controle de quem assinou e histórico completo.\n\nPara a {{empresa}}, consigo preparar uma demonstração de 20 minutos. Qual o melhor dia desta semana?",
      atualizadoEm: hora(5, 15, 0), usos: 31
    },
    {
      id: "tp_003", nome: "Apresentação AssinaDNS", categoria: "AssinaDNS",
      conteudo: "Olá, {{primeiro_nome}}!\n\nO AssinaDNS centraliza a gestão dos seus domínios, monitora alterações e protege contra apontamentos indevidos.\n\nSe fizer sentido, posso mostrar como funciona para os domínios da {{empresa}}. Podemos conversar amanhã?",
      atualizadoEm: hora(7, 9, 0), usos: 24
    },
    {
      id: "tp_004", nome: "Apresentação ConforSeg", categoria: "ConforSeg",
      conteudo: "Oi, {{primeiro_nome}}!\n\nO ConforSeg ajuda a organizar evidências, políticas e controles de segurança para auditorias e adequação à LGPD.\n\nConsigo te apresentar os pontos que normalmente são exigidos em uma primeira auditoria. Faz sentido para a {{empresa}}?",
      atualizadoEm: hora(9, 11, 30), usos: 18
    },
    {
      id: "tp_005", nome: "Follow-up de proposta", categoria: "Follow-up",
      conteudo: "Olá, {{primeiro_nome}}! Tudo bem?\n\nPassando para saber se conseguiu avaliar a proposta que enviei para a {{empresa}}.\n\nSe precisar ajustar escopo, prazo ou condições, me avise que revisamos juntos.",
      atualizadoEm: hora(1, 14, 0), usos: 56
    },
    {
      id: "tp_006", nome: "Reagendamento", categoria: "Follow-up",
      conteudo: "Oi, {{primeiro_nome}}!\n\nNão consegui falar com você no horário combinado. Sem problemas — me diga um novo horário que funcione melhor.\n\nSe preferir, posso enviar um resumo por aqui mesmo.",
      atualizadoEm: hora(12, 8, 0), usos: 12
    }
  ];

  /* Campanhas ------------------------------------------------------------- */

  var campanhas = [
    {
      id: "cp_001", nome: "Retomada feira — leads quentes", templateId: "tp_001",
      mensagem: templates[0].conteudo, status: "concluida", canal: "WhatsApp",
      leadIds: leads.slice(0, 9).map(function (l) { return l.id; }),
      publico: 9, enviados: 9, entregues: 8, falhas: 1,
      criadaEm: hora(3, 9, 0), agendadaPara: null, responsavel: "Marina Costa"
    },
    {
      id: "cp_002", nome: "AssinaPDF — apresentação", templateId: "tp_002",
      mensagem: templates[1].conteudo, status: "concluida", canal: "WhatsApp",
      leadIds: leads.filter(function (l) { return l.sistemaIds.indexOf("sis_pdf") !== -1; }).slice(0, 8).map(function (l) { return l.id; }),
      publico: 8, enviados: 8, entregues: 8, falhas: 0,
      criadaEm: hora(8, 10, 30), agendadaPara: null, responsavel: "Rafael Nunes"
    },
    {
      id: "cp_003", nome: "Follow-up de propostas", templateId: "tp_005",
      mensagem: templates[4].conteudo, status: "concluida", canal: "WhatsApp",
      leadIds: leads.filter(function (l) { return l.etapaId === "et_proposta"; }).map(function (l) { return l.id; }),
      publico: 5, enviados: 5, entregues: 5, falhas: 0,
      criadaEm: hora(1, 16, 0), agendadaPara: null, responsavel: "Marina Costa"
    },
    {
      id: "cp_004", nome: "ConforSeg — auditoria e LGPD", templateId: "tp_004",
      mensagem: templates[3].conteudo, status: "em_andamento", canal: "WhatsApp",
      leadIds: leads.filter(function (l) { return l.sistemaIds.indexOf("sis_seg") !== -1; }).slice(0, 10).map(function (l) { return l.id; }),
      publico: 10, enviados: 6, entregues: 5, falhas: 1,
      criadaEm: hora(0, 9, 0), agendadaPara: null, responsavel: "Camila Rocha"
    },
    {
      id: "cp_005", nome: "AssinaDNS — proteção de domínios", templateId: "tp_003",
      mensagem: templates[2].conteudo, status: "agendada", canal: "WhatsApp",
      leadIds: leads.filter(function (l) { return l.sistemaIds.indexOf("sis_dns") !== -1; }).slice(0, 7).map(function (l) { return l.id; }),
      publico: 7, enviados: 0, entregues: 0, falhas: 0,
      criadaEm: hora(0, 14, 0), agendadaPara: futuro(2, 9, 0), responsavel: "Rafael Nunes"
    }
  ];

  /* Notificações ---------------------------------------------------------- */

  var notificacoes = [
    { id: "nt_001", tipo: "alerta", texto: "Você tem follow-ups atrasados que precisam de atenção.", data: hora(0, 8, 0), lida: false, href: "followups.html" },
    { id: "nt_002", tipo: "sucesso", texto: "Campanha “Retomada feira — leads quentes” concluída com 8 entregas.", data: hora(1, 9, 30), lida: false, href: "mensagens.html?tab=historico" },
    { id: "nt_003", tipo: "info", texto: "Novo lead importado a partir da planilha da feira.", data: hora(2, 10, 0), lida: true, href: "leads.html" },
    { id: "nt_004", tipo: "sucesso", texto: "Negócio fechado com Bloom Cosméticos.", data: hora(3, 9, 45), lida: true, href: "leads.html?lead=ld_005" }
  ];

  /* Configurações --------------------------------------------------------- */

  var config = {
    empresa: {
      nome: "AssinaSoft",
      produto: "Painel Comercial",
      documento: "",
      email: "contato@assinasoft.com.br",
      telefone: "",
      site: "assinasoft.com.br",
      cidade: "",
      uf: "SP"
    },
    mensagens: {
      limiteDiario: 300,
      intervalo: 10,
      inicio: "08:00",
      fim: "18:00",
      optout: "Para não receber mais mensagens, responda SAIR."
    }
  };

  Painel.seed = {
    __v: 2,
    sistemas: sistemas,
    etapas: etapas,
    origens: origens,
    equipe: equipe,
    leads: leads,
    interacoes: interacoes,
    tarefas: tarefas,
    templates: templates,
    campanhas: campanhas,
    notificacoes: notificacoes,
    config: config
  };
})(window.Painel);
