/**
 * Map of transaction result codes to user-friendly messages
 */
export const ERROR_CODE_MESSAGES: Record<string, { title: string; description: string; action?: string }> = {
  "00": { title: "Transação Aprovada", description: "Pontos creditados com sucesso" },
  "01": { title: "Transação Negada", description: "Entre em contato com o suporte", action: "Verificar configurações" },
  "03": { title: "Comerciante Inválido", description: "Terminal não autorizado", action: "Verificar configurações" },
  "04": { title: "Retenção de Cartão", description: "Cliente deve contactar administrador" },
  "05": { title: "Não Aprovado", description: "Transação não autorizada" },
  "12": { title: "Transação Inválida", description: "Dados incorretos", action: "Tente novamente" },
  "13": { title: "Valor Inválido", description: "Valor da transação incorreto", action: "Verificar valor do produto" },
  "14": { title: "Cliente ID Inválido", description: "ID não reconhecido", action: "Verificar QR Code ou ID" },
  "15": { title: "Emissor Não Encontrado", description: "Sistema de pontos indisponível" },
  "19": { title: "Erro de Sistema", description: "Tente novamente", action: "Se persistir, contate suporte" },
  "25": { title: "Transação Não Encontrada", description: "Registro não existe" },
  "30": { title: "Erro de Formato", description: "Dados incorretos", action: "Verificar configuração" },
  "41": { title: "Cartão Perdido", description: "Cliente reportou perda" },
  "43": { title: "Cartão Roubado", description: "Cliente reportou roubo" },
  "51": { title: "Saldo Insuficiente", description: "Cliente sem pontos suficientes" },
  "54": { title: "Cartão Expirado", description: "Cadastro expirado" },
  "55": { title: "Senha Incorreta", description: "Senha inválida" },
  "57": { title: "Transação Não Permitida", description: "Operação não permitida" },
  "58": { title: "Terminal Não Autorizado", description: "Configuração incorreta", action: "Verificar configurações" },
  "61": { title: "Limite Excedido", description: "Valor excede limite" },
  "62": { title: "Cartão Restrito", description: "Possui restrições" },
  "63": { title: "Violação de Segurança", description: "Erro de segurança detectado" },
  "65": { title: "Limite de Transações Excedido", description: "Limite diário/mensal atingido" },
  "75": { title: "Tentativas de Senha Excedidas", description: "Cliente bloqueado" },
  "76": { title: "Conta Não Encontrada", description: "Cliente não cadastrado", action: "Verificar ID" },
  "77": { title: "Conta Inconsistente", description: "Dados inconsistentes" },
  "78": { title: "Conta Bloqueada", description: "Cliente bloqueado" },
  "91": { title: "Sistema Indisponível", description: "Servidor offline", action: "Tente em alguns minutos" },
  "92": { title: "Timeout", description: "Sem resposta do servidor", action: "Verificar conexão" },
  "94": { title: "Transação Duplicada", description: "Já processada" },
  "96": { title: "Falha do Sistema", description: "Erro interno", action: "Contate suporte técnico" },
  "UNKNOWN": { title: "Erro Desconhecido", description: "Código não reconhecido", action: "Contate suporte" },
};

export function getErrorMessage(resultCode: string) {
  return ERROR_CODE_MESSAGES[resultCode] || {
    ...ERROR_CODE_MESSAGES["UNKNOWN"],
    description: `Código: ${resultCode}`,
  };
}

export function isSuccessCode(resultCode: string): boolean {
  return resultCode === "00";
}

export function isRetriableError(resultCode: string): boolean {
  const retriableCodes = ["19", "91", "92", "96"];
  return retriableCodes.includes(resultCode);
}
