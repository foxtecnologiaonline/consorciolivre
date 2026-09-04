// Tipos escritos à mão a partir de supabase/migrations/0001_init.sql, seguindo o
// mesmo formato que `supabase gen types typescript` geraria. Quando houver um
// projeto Supabase real, substituir por:
//   supabase gen types typescript --project-id <id> > lib/supabase/database.types.ts

export type TipoPessoa = "pf" | "pj";
export type Role = "user" | "staff" | "admin";
export type KycStatus = "pendente" | "em_analise" | "aprovado" | "reprovado";
export type TipoBem = "imovel" | "veiculo" | "moto" | "servico" | "pesados";
export type AnuncioStatus =
  | "rascunho"
  | "em_analise"
  | "publicado"
  | "pausado"
  | "vendido"
  | "reprovado"
  | "expirado";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: Role;
          tipo_pessoa: TipoPessoa;
          nome_completo: string;
          documento: string;
          telefone: string | null;
          kyc_status: KycStatus;
          reputacao_media: number;
          total_transacoes: number;
          suspenso: boolean;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: {
          id: string;
          tipo_pessoa: TipoPessoa;
          nome_completo: string;
          documento: string;
          telefone?: string | null;
        };
        Update: {
          nome_completo?: string;
          telefone?: string | null;
        };
        Relationships: [];
      };
      administradoras: {
        Row: { id: string; nome: string; cnpj: string | null; ativo: boolean };
        Insert: { nome: string; cnpj?: string | null; ativo?: boolean };
        Update: { nome?: string; cnpj?: string | null; ativo?: boolean };
        Relationships: [];
      };
      kyc_verificacoes: {
        Row: {
          id: string;
          profile_id: string;
          provedor: string;
          provedor_referencia: string | null;
          status: "pendente" | "aprovado" | "reprovado";
          motivo_reprovacao: string | null;
          documento_frente_url: string | null;
          documento_verso_url: string | null;
          selfie_url: string | null;
          criado_em: string;
          concluido_em: string | null;
        };
        Insert: {
          profile_id: string;
          provedor: string;
          documento_frente_url?: string | null;
          documento_verso_url?: string | null;
          selfie_url?: string | null;
        };
        Update: {
          status?: "pendente" | "aprovado" | "reprovado";
          motivo_reprovacao?: string | null;
          concluido_em?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "kyc_verificacoes_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      cotas: {
        Row: {
          id: string;
          vendedor_id: string;
          administradora_id: string;
          tipo_bem: TipoBem;
          numero_grupo: string;
          numero_cota: string;
          valor_credito: number;
          saldo_devedor: number;
          valor_parcela: number;
          parcelas_pagas: number;
          parcelas_totais: number;
          taxa_administracao_restante: number | null;
          contemplada: boolean;
          forma_contemplacao: "sorteio" | "lance" | null;
          criado_em: string;
        };
        Insert: {
          vendedor_id: string;
          administradora_id: string;
          tipo_bem: TipoBem;
          numero_grupo: string;
          numero_cota: string;
          valor_credito: number;
          saldo_devedor: number;
          valor_parcela: number;
          parcelas_pagas: number;
          parcelas_totais: number;
          taxa_administracao_restante?: number | null;
          contemplada?: boolean;
          forma_contemplacao?: "sorteio" | "lance" | null;
        };
        Update: {
          saldo_devedor?: number;
          parcelas_pagas?: number;
          contemplada?: boolean;
          forma_contemplacao?: "sorteio" | "lance" | null;
        };
        Relationships: [
          {
            foreignKeyName: "cotas_administradora_id_fkey";
            columns: ["administradora_id"];
            isOneToOne: false;
            referencedRelation: "administradoras";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cotas_vendedor_id_fkey";
            columns: ["vendedor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      anuncios: {
        Row: {
          id: string;
          cota_id: string;
          vendedor_id: string;
          titulo: string;
          descricao: string | null;
          preco: number;
          aceita_proposta: boolean;
          status: AnuncioStatus;
          motivo_reprovacao: string | null;
          publicado_em: string | null;
          expira_em: string | null;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: {
          cota_id: string;
          vendedor_id: string;
          titulo: string;
          descricao?: string | null;
          preco: number;
          aceita_proposta?: boolean;
        };
        Update: {
          status?: AnuncioStatus;
          motivo_reprovacao?: string | null;
          publicado_em?: string | null;
          preco?: number;
          descricao?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "anuncios_cota_id_fkey";
            columns: ["cota_id"];
            isOneToOne: false;
            referencedRelation: "cotas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "anuncios_vendedor_id_fkey";
            columns: ["vendedor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      anuncio_midias: {
        Row: { id: string; anuncio_id: string; url: string; ordem: number };
        Insert: { anuncio_id: string; url: string; ordem?: number };
        Update: { url?: string; ordem?: number };
        Relationships: [
          {
            foreignKeyName: "anuncio_midias_anuncio_id_fkey";
            columns: ["anuncio_id"];
            isOneToOne: false;
            referencedRelation: "anuncios";
            referencedColumns: ["id"];
          },
        ];
      };
      propostas: {
        Row: {
          id: string;
          anuncio_id: string;
          comprador_id: string;
          valor: number;
          status: "pendente" | "aceita" | "recusada" | "expirada" | "cancelada";
          criado_em: string;
          respondido_em: string | null;
        };
        Insert: {
          anuncio_id: string;
          comprador_id: string;
          valor: number;
        };
        Update: {
          status?: "pendente" | "aceita" | "recusada" | "expirada" | "cancelada";
          respondido_em?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "propostas_anuncio_id_fkey";
            columns: ["anuncio_id"];
            isOneToOne: false;
            referencedRelation: "anuncios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "propostas_comprador_id_fkey";
            columns: ["comprador_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      transacoes: {
        Row: {
          id: string;
          anuncio_id: string;
          proposta_id: string | null;
          comprador_id: string;
          vendedor_id: string;
          valor_acordado: number;
          comissao_percentual: number;
          comissao_valor: number;
          status:
            | "aguardando_pagamento"
            | "pagamento_em_escrow"
            | "em_transferencia"
            | "concluida"
            | "cancelada"
            | "em_disputa"
            | "reembolsada";
          criado_em: string;
          atualizado_em: string;
        };
        Insert: {
          anuncio_id: string;
          proposta_id?: string | null;
          comprador_id: string;
          vendedor_id: string;
          valor_acordado: number;
        };
        Update: {
          status?:
            | "aguardando_pagamento"
            | "pagamento_em_escrow"
            | "em_transferencia"
            | "concluida"
            | "cancelada"
            | "em_disputa"
            | "reembolsada";
        };
        Relationships: [
          {
            foreignKeyName: "transacoes_anuncio_id_fkey";
            columns: ["anuncio_id"];
            isOneToOne: false;
            referencedRelation: "anuncios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transacoes_comprador_id_fkey";
            columns: ["comprador_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transacoes_vendedor_id_fkey";
            columns: ["vendedor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      transacao_eventos: {
        Row: {
          id: string;
          transacao_id: string;
          status_anterior: string | null;
          status_novo: string;
          ator_id: string | null;
          observacao: string | null;
          criado_em: string;
        };
        Insert: {
          transacao_id: string;
          status_anterior?: string | null;
          status_novo: string;
          ator_id?: string | null;
          observacao?: string | null;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: "transacao_eventos_transacao_id_fkey";
            columns: ["transacao_id"];
            isOneToOne: false;
            referencedRelation: "transacoes";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_threads: {
        Row: {
          id: string;
          anuncio_id: string;
          comprador_id: string;
          vendedor_id: string;
          criado_em: string;
        };
        Insert: {
          anuncio_id: string;
          comprador_id: string;
          vendedor_id: string;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: "chat_threads_anuncio_id_fkey";
            columns: ["anuncio_id"];
            isOneToOne: false;
            referencedRelation: "anuncios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_threads_comprador_id_fkey";
            columns: ["comprador_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_threads_vendedor_id_fkey";
            columns: ["vendedor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_mensagens: {
        Row: {
          id: string;
          thread_id: string;
          autor_id: string;
          conteudo: string;
          sinalizada: boolean;
          criado_em: string;
        };
        Insert: {
          thread_id: string;
          autor_id: string;
          conteudo: string;
          sinalizada?: boolean;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: "chat_mensagens_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "chat_threads";
            referencedColumns: ["id"];
          },
        ];
      };
      avaliacoes: {
        Row: {
          id: string;
          transacao_id: string;
          autor_id: string;
          alvo_id: string;
          nota: number;
          comentario: string | null;
          criado_em: string;
        };
        Insert: {
          transacao_id: string;
          autor_id: string;
          alvo_id: string;
          nota: number;
          comentario?: string | null;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: "avaliacoes_transacao_id_fkey";
            columns: ["transacao_id"];
            isOneToOne: false;
            referencedRelation: "transacoes";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
