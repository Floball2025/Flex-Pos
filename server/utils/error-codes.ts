/**
 * Map of transaction result codes to user-friendly messages
 */
export const ERROR_CODE_MESSAGES: Record<string, { title: string; description: string; action?: string }> = {
  // Success
  "00": {
    title: "Transação Aprovada",
    description: "Pontos creditados com sucesso",
  },

  // General Errors
  "01": {
    title: "Transação Negada",
    description: "Entre em contato com o suporte",
    action: "Verificar configurações do terminal",
  },
  "03": {
    title: "Comerciante Inválido",
    description: "Terminal não autorizado",
    action: "Verificar configurações do terminal",
  },
  "04": {
    title: "Retenção de Cartão",
    description: "Cliente deve contactar administrador",
  },
  "05": {
    title: "Não Aprovado",
    description: "Transação não autorizada",
  },
  "12": {
    title: "Transação Inválida",
    description: "Verifique os dados enviados",
    action: "Tente novamente ou contate o suporte",
  },
  "13": {
    title: "Valor Inválido",
    description: "O valor da transação está incorreto",
    action: "Verificar valor do produto",
  },
  "14": {
    title: "Número de Cartão Inválido",
    description: "Cliente ID não reconhecido",
    action: "Verificar o QR Code ou ID do cliente",
  },
  "15": {
    title: "Emissor Não Encontrado",
    description: "Sistema de pontos não disponível",
  },
  "19": {
    title: "Erro de Sistema",
    description: "Tente novamente",
    action: "Se persistir, contate o suporte",
  },
  "25": {
    title: "Transação Não Encontrada",
    description: "Registro não existe no sistema",
  },
  "30": {
    title: "Erro de Formato",
    description: "Dados da transação incorretos",
    action: "Verifique a configuração do terminal",
  },
  "41": {
    title: "Cartão Perdido",
    description: "Cliente reportou perda do cartão",
  },
  "43": {
    title: "Cartão Roubado",
    description: "Cliente reportou roubo do cartão",
  },
  "51": {
    title: "Saldo Insuficiente",
    description: "Cliente não possui pontos suficientes",
  },
  "54": {
    title: "Cartão Expirado",
    description: "Cadastro do cliente expirado",
  },
  "55": {
    title: "Senha Incorreta",
    description: "Senha inválida",
  },
  "57": {
    title: "Transação Não Permitida",
    description: "Este tipo de operação não é permitida",
  },
  "58": {
    title: "Terminal Não Autorizado",
    description: "Terminal não configurado corretamente",
    action: "Verificar configurações",
  },
  "61": {
    title: "Limite Excedido",
    description: "Valor da transação excede o limite",
  },
  "62": {
    title: "Cartão Restrito",
    description: "Cartão possui restrições",
  },
  "63": {
    title: "Violação de Segurança",
    description: "Erro de segurança detectado",
  },
  "65": {
    title: "Limite de Transações Excedido",
    description: "Cliente atingiu limite diário/mensal",
  },
  "75": {
    title: "Tentativas de Senha Excedidas",
    description: "Cliente bloqueado por tentativas",
  },
  "76": {
    title: "Conta Não Encontrada",
    description: "Cliente não cadastrado",
    action: "Verificar ID do cliente",
  },
  "77": {
    title: "Conta Inconsistente",
    description: "Dados do cliente inconsistentes",
  },
  "78": {
    title: "Conta Bloqueada",
    description: "Cliente está bloqueado",
  },
  "91": {
    title: "Sistema Indisponível",
    description: "Servidor de pontos offline",
    action: "Tente novamente em alguns minutos",
  },
  "92": {
    title: "Timeout de Comunicação",
    description: "Sem resposta do servidor",
    action: "Verificar conexão de internet",
  },
  "94": {
    title: "Transação Duplicada",
    description: "Esta transação já foi processada",
  },
  "96": {
    title: "Falha do Sistema",
    description: "Erro interno do servidor",
    action: "Contate o suporte técnico",
  },

  // Default for unknown codes
  "UNKNOWN": {
    title: "Erro Desconhecido",
    description: "Código de erro não reconhecido",
    action: "Contate o suporte técnico",
  },
};

/**
 * Get error message details for a given result code
 */
export function getErrorMessage(resultCode: string): { title: string; description: string; action?: string } {
  return ERROR_CODE_MESSAGES[resultCode] || {
    ...ERROR_CODE_MESSAGES["UNKNOWN"],
    description: `Código: ${resultCode}`,
  };
}

/**
 * Check if a result code indicates success
 */
export function isSuccessCode(resultCode: string): boolean {
  return resultCode === "00";
}

/**
 * Check if a result code indicates a retriable error
 */
export function isRetriableError(resultCode: string): boolean {
  const retriableCodes = ["19", "91", "92", "96"];
  return retriableCodes.includes(resultCode);
}
