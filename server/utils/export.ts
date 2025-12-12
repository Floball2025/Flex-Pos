import { TransactionHistory } from "@shared/schema";

/**
 * Generate CSV content from transaction history
 */
export function generateCSV(transactions: TransactionHistory[]): string {
  const headers = [
    "Data/Hora",
    "Cliente ID",
    "RRN",
    "Código Resultado",
    "Bônus",
    "Saldo",
    "Mensagem de Erro"
  ];

  const rows = transactions.map(tx => [
    new Date(tx.timestamp).toLocaleString("pt-BR"),
    tx.clientID,
    tx.rrn || "",
    tx.resultCode,
    tx.bonus || "",
    tx.balance || "",
    tx.errorMessage || ""
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
  ].join("\n");

  return csvContent;
}

/**
 * Generate simple HTML for PDF conversion
 */
export function generatePDFHTML(transactions: TransactionHistory[]): string {
  const rows = transactions.map(tx => {
    const isSuccess = tx.resultCode === "00";
    const rowClass = isSuccess ? "success" : "error";
    
    return `
      <tr class="${rowClass}">
        <td>${new Date(tx.timestamp).toLocaleString("pt-BR")}</td>
        <td>${tx.clientID}</td>
        <td>${tx.rrn || "-"}</td>
        <td>${tx.resultCode}</td>
        <td>${tx.bonus || "-"}</td>
        <td>${tx.balance || "-"}</td>
        <td>${tx.errorMessage || "-"}</td>
      </tr>
    `;
  }).join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Relatório de Transações - Bem Lindinha</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 20px;
        }
        h1 {
          color: #1d6ec1;
          border-bottom: 2px solid #1d6ec1;
          padding-bottom: 10px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        th {
          background-color: #1d6ec1;
          color: white;
          padding: 12px;
          text-align: left;
          font-weight: bold;
        }
        td {
          padding: 10px;
          border-bottom: 1px solid #ddd;
        }
        tr.success {
          background-color: #f0fdf4;
        }
        tr.error {
          background-color: #fef2f2;
        }
        .footer {
          margin-top: 30px;
          padding-top: 10px;
          border-top: 1px solid #ddd;
          font-size: 12px;
          color: #666;
        }
      </style>
    </head>
    <body>
      <h1>Relatório de Transações - Bem Lindinha</h1>
      <p><strong>Data de Geração:</strong> ${new Date().toLocaleString("pt-BR")}</p>
      <p><strong>Total de Transações:</strong> ${transactions.length}</p>
      
      <table>
        <thead>
          <tr>
            <th>Data/Hora</th>
            <th>Cliente ID</th>
            <th>RRN</th>
            <th>Resultado</th>
            <th>Bônus</th>
            <th>Saldo</th>
            <th>Erro</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      
      <div class="footer">
        <p>Sistema de Pontos de Fidelidade - Bem Lindinha</p>
      </div>
    </body>
    </html>
  `;
}
