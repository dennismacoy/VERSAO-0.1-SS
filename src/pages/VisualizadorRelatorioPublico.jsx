import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { FileText, Download, Loader2, CheckCircle2, AlertTriangle, ArrowLeft } from 'lucide-react';
import { useProducts } from '../context/ProductsContext';
import { generateRelatorioPDF } from '../lib/pdfGenerator';
import { parseEstoque, getEstoqueNumerico } from '../lib/utils';

export default function VisualizadorRelatorioPublico() {
  const [searchParams] = useSearchParams();
  const { products, loading } = useProducts();
  const [downloadReady, setDownloadReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const razoesParam = searchParams.get('razoes');
  const filtroParam = searchParams.get('filtro') || 'com_estoque';

  const razoes = useMemo(() => {
    if (!razoesParam) return [];
    return razoesParam.split(',').map(r => r.trim()).filter(Boolean);
  }, [razoesParam]);

  const handleGerarPDF = () => {
    if (products.length === 0) return;
    if (razoes.length === 0) {
      setErrorMsg('Nenhuma Razão Social foi especificada no link.');
      return;
    }

    try {
      const batch = razoes.map(rz => {
        let rzData = products.filter(item => {
          const itemRz = item.RAZAOSOCIAL || item.razaosocial || '';
          return itemRz.toLowerCase() === rz.toLowerCase();
        });

        if (filtroParam === 'com_estoque') {
          rzData = rzData.filter(item => parseEstoque(item.ESTOQUE || item.QTE || item.estoque || 0));
        }

        let rzTotalInRisk = 0;
        rzData.forEach(item => {
          const estoqueStr = item.ESTOQUE || item.QTE || item.estoque || 0;
          const temEstoque = parseEstoque(estoqueStr);
          const diasSemVenda = Number(item.DIAS_SEM_VENDA || item.ISV || item.dias_sem_venda || 0);
          const estoqueNum = getEstoqueNumerico(estoqueStr);
          const custo = Number(item.CUSTO || item.PRECO || item.custo || 0);
          const valorEstoque = estoqueNum * custo;

          if (diasSemVenda > 6 && temEstoque) {
            rzTotalInRisk += valorEstoque;
          }
        });

        // Encontra a grafia correta da razão social a partir dos dados do produto se disponível
        const displayName = rzData.length > 0 ? (rzData[0].RAZAOSOCIAL || rzData[0].razaosocial) : rz;

        return {
          filteredData: rzData,
          totalInRisk: rzTotalInRisk,
          selectedRazao: displayName
        };
      });

      generateRelatorioPDF(batch);
      setDownloadReady(true);
    } catch (e) {
      console.error(e);
      setErrorMsg('Ocorreu um erro ao gerar o PDF em lote.');
    }
  };

  // Dispara automaticamente quando os produtos terminarem de carregar
  useEffect(() => {
    if (!loading && products.length > 0 && razoes.length > 0) {
      handleGerarPDF();
    }
  }, [loading, products, razoes]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
      <div className="bg-card p-8 rounded-2xl shadow-2xl border border-border w-full max-w-md flex flex-col items-center text-center space-y-6">
        
        <div className="flex items-center justify-center p-4 bg-primary/10 rounded-full text-primary">
          {loading ? (
            <Loader2 className="animate-spin w-12 h-12" />
          ) : errorMsg ? (
            <AlertTriangle className="w-12 h-12 text-destructive" />
          ) : (
            <CheckCircle2 className="w-12 h-12 text-green-500" />
          )}
        </div>

        <div>
          <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-foreground">
            {loading ? 'Preparando Dados...' : errorMsg ? 'Falha na Geração' : 'Relatório Pronto!'}
          </h2>
          <p className="text-sm font-bold text-muted-foreground mt-2">
            {loading 
              ? 'Carregando lista de produtos e calculando auditoria...' 
              : errorMsg 
                ? errorMsg 
                : 'O PDF do relatório em lote foi gerado e o download deve iniciar.'}
          </p>
        </div>

        {razoes.length > 0 && (
          <div className="w-full bg-muted/40 p-4 rounded-xl text-left border border-border space-y-2">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">Razões no lote ({razoes.length}):</span>
            <div className="max-h-24 overflow-y-auto custom-scrollbar text-xs font-bold text-foreground space-y-1">
              {razoes.map((rz, idx) => (
                <div key={idx} className="truncate">• {rz}</div>
              ))}
            </div>
          </div>
        )}

        {!loading && !errorMsg && (
          <div className="w-full flex flex-col gap-3">
            <button
              onClick={handleGerarPDF}
              className="w-full btn-primary py-4 flex items-center justify-center gap-3 uppercase tracking-widest font-black text-sm"
            >
              <Download size={18} />
              Baixar PDF Novamente
            </button>
            <p className="text-[10px] text-muted-foreground font-bold">
              Filtro ativo: {filtroParam === 'com_estoque' ? 'Apenas itens com estoque' : 'Todos os itens'}
            </p>
          </div>
        )}

        <div className="pt-4 border-t border-border w-full flex justify-center">
          <Link 
            to="/" 
            className="flex items-center gap-2 text-xs font-black text-muted-foreground hover:text-primary uppercase tracking-widest transition-colors"
          >
            <ArrowLeft size={14} />
            Voltar ao SmartStock
          </Link>
        </div>

      </div>
    </div>
  );
}
