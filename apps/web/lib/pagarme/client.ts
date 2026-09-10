// Integração com a API v5 do Pagar.me (docs/ARCHITECTURE.md §5.1 — decisão
// única de gateway, split via recipient_id).
//
// IMPORTANTE: este ambiente de desenvolvimento não tem acesso à documentação
// oficial (docs.pagar.me bloqueado pelo proxy de rede) nem a uma chave de API
// para testar contra o sandbox. O formato do payload abaixo segue o contrato
// público conhecido da API v5 de recebedores (POST /core/v5/recipients,
// register_information + default_bank_account + transfer_settings). Validar
// no sandbox do Pagar.me antes de usar em produção — se algum nome de campo
// mudou, o ajuste fica isolado neste arquivo.

const PAGARME_API_BASE = "https://api.pagar.me/core/v5";

export class PagarmeError extends Error {}

export type TipoPessoaPagarme = "individual" | "company";
export type TipoContaPagarme = "checking" | "savings";

export interface DadosRecebedor {
  nome: string;
  email: string;
  documento: string; // CPF/CNPJ, apenas dígitos
  tipoPessoa: TipoPessoaPagarme;
}

export interface DadosBancarios {
  bancoCodigo: string;
  agencia: string;
  agenciaDv?: string;
  conta: string;
  contaDv: string;
  tipoConta: TipoContaPagarme;
}

export interface PayloadCriacaoRecebedor {
  register_information: {
    type: TipoPessoaPagarme;
    document: string;
    email: string;
    name?: string;
    company_name?: string;
  };
  default_bank_account: {
    holder_name: string;
    holder_type: TipoPessoaPagarme;
    holder_document: string;
    bank: string;
    branch_number: string;
    branch_check_digit: string;
    account_number: string;
    account_check_digit: string;
    type: TipoContaPagarme;
  };
  transfer_settings: {
    transfer_enabled: boolean;
    transfer_interval: "daily";
  };
  code: string;
}

export function montarPayloadCriacaoRecebedor(
  recebedor: DadosRecebedor,
  banco: DadosBancarios
): PayloadCriacaoRecebedor {
  return {
    register_information: {
      type: recebedor.tipoPessoa,
      document: recebedor.documento,
      email: recebedor.email,
      ...(recebedor.tipoPessoa === "individual"
        ? { name: recebedor.nome }
        : { company_name: recebedor.nome }),
    },
    default_bank_account: {
      holder_name: recebedor.nome,
      holder_type: recebedor.tipoPessoa,
      holder_document: recebedor.documento,
      bank: banco.bancoCodigo,
      branch_number: banco.agencia,
      branch_check_digit: banco.agenciaDv ?? "",
      account_number: banco.conta,
      account_check_digit: banco.contaDv,
      type: banco.tipoConta,
    },
    transfer_settings: {
      transfer_enabled: true,
      transfer_interval: "daily",
    },
    code: recebedor.documento,
  };
}

export interface ClientePagador {
  nome: string;
  email: string;
  documento: string;
  tipoPessoa: TipoPessoaPagarme;
}

export interface DadosPedidoPix {
  valorCentavos: number;
  descricao: string;
  referenciaExterna: string; // transacoes.id — vai em items[].code, útil pra conciliação
  cliente: ClientePagador;
  expiraEmSegundos?: number;
}

export interface PayloadCriacaoPedidoPix {
  items: Array<{ amount: number; description: string; quantity: number; code: string }>;
  customer: {
    name: string;
    email: string;
    type: TipoPessoaPagarme;
    document: string;
    document_type: "CPF" | "CNPJ";
  };
  payments: Array<{ payment_method: "pix"; pix: { expires_in: number } }>;
}

export function montarPayloadPedidoPix(dados: DadosPedidoPix): PayloadCriacaoPedidoPix {
  return {
    items: [
      {
        amount: dados.valorCentavos,
        description: dados.descricao,
        quantity: 1,
        code: dados.referenciaExterna,
      },
    ],
    customer: {
      name: dados.cliente.nome,
      email: dados.cliente.email,
      type: dados.cliente.tipoPessoa,
      document: dados.cliente.documento,
      document_type: dados.cliente.tipoPessoa === "individual" ? "CPF" : "CNPJ",
    },
    payments: [
      {
        payment_method: "pix",
        pix: { expires_in: dados.expiraEmSegundos ?? 3600 },
      },
    ],
  };
}

export interface PedidoPixCriado {
  orderId: string;
  qrCode: string | null;
  qrCodeUrl: string | null;
  expiraEm: string | null;
}

// Cria o pedido no Pagar.me e retorna o necessário para exibir o QR code ao
// comprador. Sem `split`: o valor fica 100% com a conta da plataforma até a
// liberação de escrow (docs/ARCHITECTURE.md §5.1) — só ali o recipient_id do
// vendedor entra em jogo, via transferência explícita.
export async function criarPedidoPix(dados: DadosPedidoPix): Promise<PedidoPixCriado> {
  const secretKey = process.env.PAGARME_SECRET_KEY;
  if (!secretKey) {
    throw new PagarmeError("PAGARME_SECRET_KEY não configurada.");
  }

  const resposta = await fetch(`${PAGARME_API_BASE}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: autenticacaoBasica(secretKey),
    },
    body: JSON.stringify(montarPayloadPedidoPix(dados)),
  });

  if (!resposta.ok) {
    const corpo = await resposta.text();
    throw new PagarmeError(`Falha ao criar pedido PIX no Pagar.me (${resposta.status}): ${corpo}`);
  }

  const pedido = (await resposta.json()) as {
    id: string;
    charges?: Array<{
      last_transaction?: { qr_code?: string; qr_code_url?: string; expires_at?: string };
    }>;
  };

  if (!pedido.id) {
    throw new PagarmeError("Resposta do Pagar.me sem id de pedido.");
  }

  const ultimaTransacao = pedido.charges?.[0]?.last_transaction;
  return {
    orderId: pedido.id,
    qrCode: ultimaTransacao?.qr_code ?? null,
    qrCodeUrl: ultimaTransacao?.qr_code_url ?? null,
    expiraEm: ultimaTransacao?.expires_at ?? null,
  };
}

function autenticacaoBasica(secretKey: string) {
  return "Basic " + Buffer.from(`${secretKey}:`).toString("base64");
}

// Cria o recebedor no Pagar.me e retorna o id a persistir em
// profiles.pagarme_recipient_id. Lança PagarmeError em qualquer resposta
// não-2xx — quem chama decide como comunicar isso ao usuário.
export async function criarRecebedor(
  recebedor: DadosRecebedor,
  banco: DadosBancarios
): Promise<{ id: string }> {
  const secretKey = process.env.PAGARME_SECRET_KEY;
  if (!secretKey) {
    throw new PagarmeError("PAGARME_SECRET_KEY não configurada.");
  }

  const resposta = await fetch(`${PAGARME_API_BASE}/recipients`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: autenticacaoBasica(secretKey),
    },
    body: JSON.stringify(montarPayloadCriacaoRecebedor(recebedor, banco)),
  });

  if (!resposta.ok) {
    const corpo = await resposta.text();
    throw new PagarmeError(`Falha ao criar recebedor no Pagar.me (${resposta.status}): ${corpo}`);
  }

  const dados = (await resposta.json()) as { id: string };
  if (!dados.id) {
    throw new PagarmeError("Resposta do Pagar.me sem id de recebedor.");
  }
  return { id: dados.id };
}
