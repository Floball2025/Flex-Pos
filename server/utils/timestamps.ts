/**
 * Interface para componentes de data/hora no timezone de Brasília
 * 
 * Por que usar timezone de Brasília?
 * - A API L2Flow espera timestamps no horário local brasileiro
 * - Usar UTC causaria diferença de 3 horas e rejeição pela API
 */
interface BrasiliaTimeComponents {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
  milliseconds: number;
}

/**
 * Obtém componentes de data/hora atuais no timezone de Brasília (America/Sao_Paulo)
 * 
 * IMPORTANTE: Esta função contém correções críticas para bugs de produção
 * 
 * Por que não usar simplesmente new Date()?
 * - new Date() retorna UTC, mas a API L2Flow exige horário de Brasília
 * 
 * Por que usar toLocaleString ao invés de bibliotecas como moment/date-fns?
 * - Nativo do Node.js, sem dependências extras
 * - Suporta qualquer timezone via Intl API
 * 
 * BUG CRÍTICO CORRIGIDO:
 * Algumas localizações retornam hora "24" para meia-noite ao invés de "00"
 * Exemplo: "11/18/2025, 24:20:38" ao invés de "11/18/2025, 00:20:38"
 * Isso causava timestamps inválidos como "20251118242038709"
 * A API L2Flow rejeitava com erro "71: Error in DLS integration"
 * Solução: Converter hora 24 → 00 explicitamente
 */
function getBrasiliaTimeComponents(): BrasiliaTimeComponents {
  const now = new Date();
  
  // Formata data/hora no timezone de Brasília usando Intl API nativa
  // Resultado esperado: "MM/DD/YYYY, HH:mm:ss" (ex: "11/18/2025, 15:30:45")
  const brasiliaTimeString = now.toLocaleString('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false  // Importante: formato 24h (mas pode retornar "24" para meia-noite!)
  });
  
  // Faz parse do formato "MM/DD/YYYY, HH:mm:ss"
  const [datePart, timePart] = brasiliaTimeString.split(', ');
  const [month, day, year] = datePart.split('/');
  const [hours, minutes, seconds] = timePart.split(':');
  
  // CORREÇÃO CRÍTICA: hora 24 → 00 (bug de meia-noite)
  // Algumas localizações retornam "24:00:00" ao invés de "00:00:00"
  // Isso faz a API rejeitar o timestamp com erro 71
  // Testado em produção: "20251118242038709" falha, "20251118002038709" funciona
  let hourValue = parseInt(hours);
  if (hourValue === 24) {
    hourValue = 0;
  }
  
  return {
    year: parseInt(year),
    month: parseInt(month),
    day: parseInt(day),
    hours: hourValue,
    minutes: parseInt(minutes),
    seconds: parseInt(seconds),
    // Nota: milissegundos vêm do Date original, não do toLocaleString
    // (toLocaleString não retorna milissegundos)
    milliseconds: now.getMilliseconds()
  };
}

/**
 * Gera timestamp no formato YYYYMMDDHHmmssSSS (17 dígitos)
 * 
 * QUANDO USAR:
 * - Campo "created" em TODAS as requisições à API L2Flow
 * - ActionType 3 (consulta saldo), 4 (venda), 8 (cashback)
 * 
 * FORMATO EXIGIDO PELA API:
 * - Ano (4 dígitos) + Mês (2) + Dia (2) + Hora (2) + Minuto (2) + Segundo (2) + Milissegundos (3)
 * - Exemplo: "20251118153045789" = 18/11/2025 15:30:45.789
 * - Total: 17 dígitos (não pode ter mais ou menos!)
 * 
 * TIMEZONE:
 * - Usa horário de Brasília (America/Sao_Paulo)
 * - Não confundir com UTC! API rejeita timestamps UTC
 * 
 * @returns String com 17 dígitos representando timestamp atual em Brasília
 */
export function generateCreatedTimestamp(): string {
  const time = getBrasiliaTimeComponents();
  const year = time.year;
  const month = String(time.month).padStart(2, '0');
  const day = String(time.day).padStart(2, '0');
  const hours = String(time.hours).padStart(2, '0');
  const minutes = String(time.minutes).padStart(2, '0');
  const seconds = String(time.seconds).padStart(2, '0');
  const milliseconds = String(time.milliseconds).padStart(3, '0');
  
  return `${year}${month}${day}${hours}${minutes}${seconds}${milliseconds}`;
}

/**
 * Gera RRN (Reference Retrieval Number) no formato YYYYMMDDHHmmssSS (16 dígitos)
 * 
 * QUANDO USAR:
 * - Campo "rrn" em transações de VENDA (actionType 4) e CASHBACK (actionType 8)
 * - NÃO usar em consulta de saldo (actionType 3) - API rejeita se tiver RRN!
 * 
 * FORMATO EXIGIDO PELA API:
 * - Ano (4 dígitos) + Mês (2) + Dia (2) + Hora (2) + Minuto (2) + Segundo (2) + Centésimos (2)
 * - Exemplo: "2025111815304578" = 18/11/2025 15:30:45.78 (note: só 2 dígitos de fração)
 * - Total: 16 dígitos (diferente do 'created' que tem 17!)
 * 
 * POR QUE CENTÉSIMOS AO INVÉS DE MILISSEGUNDOS?
 * - RRN exige 16 dígitos, não 17
 * - Solução: dividir milissegundos por 10 e pegar 2 dígitos
 * - Ex: 789ms ÷ 10 = 78 centésimos
 * 
 * IMPORTANTE:
 * - Consulta de saldo (actionType 3) não deve ter campo "rrn"
 * - Adicionar rrn em consulta de saldo causa erro 71 da API
 * 
 * @returns String com 16 dígitos representando RRN único da transação
 */
export function generateRRNTimestamp(): string {
  const time = getBrasiliaTimeComponents();
  const year = time.year;
  const month = String(time.month).padStart(2, '0');
  const day = String(time.day).padStart(2, '0');
  const hours = String(time.hours).padStart(2, '0');
  const minutes = String(time.minutes).padStart(2, '0');
  const seconds = String(time.seconds).padStart(2, '0');
  // Converte milissegundos (0-999) para centésimos (0-99)
  // Exemplo: 789ms → 78 centésimos
  const centiseconds = String(Math.floor(time.milliseconds / 10)).padStart(2, '0');
  
  return `${year}${month}${day}${hours}${minutes}${seconds}${centiseconds}`;
}
