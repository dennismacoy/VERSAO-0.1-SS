import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { FileText, Download, Loader2, CheckCircle2, AlertTriangle, ArrowLeft } from 'lucide-react';
import { get as idbGet } from 'idb-keyval';
import { fetchProductsFromFirebase } from '../lib/firebase';
import { generateRelatorioPDF } from '../lib/pdfGenerator';
import { parseEstoque, getEstoqueNumerico } from '../lib/utils';

export default function VisualizadorRelatorioPublico() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [dadosPdf, setDadosPdf] = useState(null);
  const [downloadReady, setDownloadReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const razoesParam = searchParams.get('razoes');
  const filtroParam = searchParams.get('filtro') || 'com_estoque';

  const razoes = useMemo(() => {
    if (!razoesParam) return [];
    return razoesParam.split(',').map(r => r.trim()).filter(Boolean);
  }, [razoesParam]);

  const isCurrentlyLoading = loading || !dadosPdf;

  // Busca e reconstrói os dados a partir do cache (idb-keyval) ou Firebase
  useEffect(() => {
    let isMounted = true;

    async function loadAndReconstruct() {
      try {
        setLoading(true);
        setErrorMsg('');

        if (!razoesParam) {
          setErrorMsg('Nenhuma Razão Social foi especificada no link.');
          setLoading(false);
          return;
        }

        let allProducts = [];
        // 1. Tentar obter a base de produtos do cache do IndexedDB
        try {
          allProducts = await idbGet('erp_products_cache');
        } catch (e) {
          console.warn('Erro ao ler cache do IndexedDB no Visualizador:', e);
        }

        // 2. Se não houver dados no cache, buscar diretamente do Firebase
        if (!allProducts || allProducts.length === 0) {
          console.log('Cache local vazio ou inexistente. Buscando produtos do Firebase...');
          allProducts = await fetchProductsFromFirebase();
        }

        if (!allProducts || allProducts.length === 0) {
          throw new Error('Não foi possível obter a base de produtos.');
        }

        // 3. Reconstruir os dados reais correspondentes às razões sociais fornecidas
        const razoesLista = razoesParam.split(',').map(r => r.trim()).filter(Boolean);
        
        const batch = razoesLista.map(rz => {
          let rzData = allProducts.filter(item => {
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

          const displayName = rzData.length > 0 ? (rzData[0].RAZAOSOCIAL || rzData[0].razaosocial) : rz;

          return {
            cliente: displayName,
            dados: rzData,
            filteredData: rzData, // retrocompatibilidade
            totalInRisk: rzTotalInRisk,
            selectedRazao: displayName // retrocompatibilidade
          };
        });

        if (isMounted) {
          setDadosPdf(batch);
          setLoading(false);
        }
      } catch (err) {
        console.error('Erro ao reconstruir dados no Visualizador:', err);
        if (isMounted) {
          setErrorMsg(err.message || 'Erro ao carregar dados do relatório.');
          setLoading(false);
        }
      }
    }

    loadAndReconstruct();

    return () => {
      isMounted = false;
    };
  }, [razoesParam, filtroParam]);

  const handleGerarPDF = () => {
    if (!dadosPdf || dadosPdf.length === 0) {
      setErrorMsg('Os dados reais do relatório ainda não foram carregados.');
      return;
    }

    try {
      generateRelatorioPDF(dadosPdf);
      setDownloadReady(true);
    } catch (e) {
      console.error('Erro ao gerar o relatório em PDF:', e);
      alert('Erro detalhado ao gerar o relatório em PDF: ' + e.message);
    }
  };

  // Dispara automaticamente quando a reconstrução for concluída e dadosPdf estiver preenchido
  useEffect(() => {
    if (!loading && dadosPdf && dadosPdf.length > 0) {
      handleGerarPDF();
    }
  }, [loading, dadosPdf]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
      <div className="bg-card p-8 rounded-2xl shadow-2xl border border-border w-full max-w-md flex flex-col items-center text-center space-y-6">
        
        <div className="flex items-center justify-center p-4 bg-primary/10 rounded-full text-primary">
          {isCurrentlyLoading ? (
            <Loader2 className="animate-spin w-12 h-12" />
          ) : errorMsg ? (
            <AlertTriangle className="w-12 h-12 text-destructive" />
          ) : (
            <CheckCircle2 className="w-12 h-12 text-green-500" />
          )}
        </div>

        <div>
          <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-foreground">
            {isCurrentlyLoading ? 'Preparando Dados...' : errorMsg ? 'Falha na Geração' : 'Relatório Pronto!'}
          </h2>
          <p className="text-sm font-bold text-muted-foreground mt-2">
            {isCurrentlyLoading 
              ? 'Carregando/Construindo PDF...' 
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

        {!isCurrentlyLoading && !errorMsg && (
          <div className="w-full flex flex-col gap-3">
            <button
              onClick={handleGerarPDF}
              disabled={isCurrentlyLoading}
              className={`w-full btn-primary py-4 flex items-center justify-center gap-3 uppercase tracking-widest font-black text-sm ${isCurrentlyLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
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
