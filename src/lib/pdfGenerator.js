import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import JsBarcode from 'jsbarcode';

const formatCurrency = (val) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
};

export const generatePreVendaPDF = (cart, atribuicao, total) => {
  if (!cart || cart.length === 0) return;
  
  try {
    const doc = new jsPDF();
    const docWidth = doc.internal.pageSize.getWidth();
    
    // Header Corporate
    doc.setFillColor(255, 215, 0); // Primary Yellow
    doc.rect(0, 0, docWidth, 40, 'F');
    
    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("SmartStock ERP", 14, 25);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("CONTROLE DE LOGÍSTICA & PRÉ-VENDA", 14, 32);
    
    doc.setFontSize(12);
    doc.text(`Documento: #${Date.now().toString().slice(-6)}`, docWidth - 60, 20);
    doc.text(`Data: ${new Date().toLocaleDateString()}`, docWidth - 60, 28);

    // Summary Section
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(14, 45, docWidth - 28, 20, 3, 3, 'F');
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Responsável Separação:", 20, 54);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.text(atribuicao || "NÃO DEFINIDO", 65, 54);
    
    doc.setFontSize(16);
    doc.text(`TOTAL GERAL: ${formatCurrency(total)}`, docWidth - 85, 58);

    const tableData = cart.map(item => [
      { content: "", styles: { minCellHeight: 20 } }, // Barcode
      item.codigo,
      item.descricao,
      item.embalagem || item.emb || '',
      item.qtd.toString(),
      formatCurrency(item.preco_unitario || item.preco),
      formatCurrency(item.subtotal)
    ]);

    autoTable(doc, {
      startY: 75,
      head: [['Cod. Barras', 'Cód', 'Descrição', 'Emb', 'Qtd', 'Preço', 'Subtotal']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [0, 0, 0], textColor: [255, 215, 0], fontStyle: 'bold', fontSize: 9 },
      styles: { valign: 'middle', fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 35 },
        2: { cellWidth: 'auto' }
      },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 0) {
          const item = cart[data.row.index];
          const canvas = document.createElement("canvas");
          try {
            JsBarcode(canvas, item.codigo, { format: "CODE128", displayValue: false, height: 40, width: 2, margin: 0 });
            const barcodeDataUrl = canvas.toDataURL("image/png");
            doc.addImage(barcodeDataUrl, 'PNG', data.cell.x + 2, data.cell.y + 2, 30, 15);
          } catch (e) {
            console.error("Barcode fail:", e);
          }
        }
      }
    });

    doc.save(`prevenda_${Date.now()}.pdf`);
  } catch (error) {
    console.error("Erro crítico ao gerar PDF de Pré-Venda:", error);
    alert("Ocorreu um erro ao gerar o PDF. Verifique o console para mais detalhes.");
  }
};

export const generatePickingPDF = (item) => {
  try {
    const doc = new jsPDF();
    const docWidth = doc.internal.pageSize.getWidth();

    // Picking Header
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, docWidth, 35, 'F');
    
    doc.setTextColor(255, 215, 0);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("LISTA DE SEPARAÇÃO (PICKING)", 14, 22);
    
    doc.setFontSize(10);
    doc.text(`ID: ${item.id}   |   Data: ${new Date(item.data).toLocaleDateString()}`, 14, 30);
    
    doc.setTextColor(255, 255, 255);
    doc.text(`Responsável: ${item.atribuicao}`, docWidth - 60, 30);

    const tableData = (item.itens || []).map(prod => [
      prod.codigo,
      prod.descricao,
      prod.embalagem || prod.emb || '',
      prod.estoque || '0',
      prod.qtd.toString()
    ]);

    autoTable(doc, {
      startY: 45,
      head: [['Código', 'Descrição do Produto', 'Emb', 'Estoque', 'Qtd Pedida']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0], fontSize: 12, fontStyle: 'bold' },
      styles: { fontSize: 14, cellPadding: 4 },
      alternateRowStyles: { fillColor: [245, 245, 245] }
    });

    doc.save(`picking_${item.id}.pdf`);
  } catch (error) {
    console.error("Erro crítico ao gerar PDF de Picking:", error);
    alert("Ocorreu um erro ao gerar o PDF. Verifique o console para mais detalhes.");
  }
};

export const generateRelatorioPDF = (filteredData, totalInRisk, selectedRazao) => {
  try {
    const doc = new jsPDF();
    const docWidth = doc.internal.pageSize.getWidth();

    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, docWidth, 40, 'F');
    
    doc.setTextColor(255, 215, 0);
    doc.setFontSize(22);
    doc.text("RELATÓRIO DE AUDITORIA DE ESTOQUE", 14, 25);
    
    doc.setFontSize(10);
    doc.text(`TOTAL EM RISCO (IDW): ${formatCurrency(totalInRisk)}`, 14, 32);

    if (selectedRazao) {
      doc.setFontSize(12);
      doc.text(`RAZÃO SOCIAL: ${selectedRazao}`, 14, 38);
    }

    autoTable(doc, {
      startY: selectedRazao ? 45 : 40,
      head: [['Cód', 'Descrição', 'Razão Social', 'Dias S/ Venda', 'Valor Est.', 'Risco (V*D)']],
      body: filteredData.map(item => [
        item.codigo,
        item.descricao,
        item.razaosocial,
        item.dias_sem_venda || '0',
        formatCurrency(item.valor_estoque),
        formatCurrency((Number(item.dias_sem_venda) || 0) * (Number(item.valor_estoque) || 0))
      ]),
      theme: 'grid',
      headStyles: { fillColor: [0, 0, 0], textColor: [255, 215, 0] }
    });

    doc.save(`relatorio_auditoria_${Date.now()}.pdf`);
  } catch (error) {
    console.error("Erro crítico ao gerar PDF de Relatório:", error);
    alert("Ocorreu um erro ao gerar o PDF. Verifique o console para mais detalhes.");
  }
};
