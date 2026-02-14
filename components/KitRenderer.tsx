
import React, { useState, useEffect } from 'react';
import { GeneratedAsset } from '../types';

interface KitRendererProps {
  content: string;
  assets: GeneratedAsset[];
  onReset?: () => void;
  isGenerating?: boolean;
  cooldownMessage?: string | null;
  onEditImage?: (asset: GeneratedAsset) => void;
}

const KitRenderer: React.FC<KitRendererProps> = ({ content, assets, onReset, isGenerating, cooldownMessage, onEditImage }) => {
  const [selectedAsset, setSelectedAsset] = useState<{ asset: GeneratedAsset; index: number } | null>(null);
  const [timer, setTimer] = useState(45);

  useEffect(() => {
    let interval: any;
    if (isGenerating && !cooldownMessage) {
      setTimer(45);
      interval = setInterval(() => {
        setTimer((prev) => (prev > 0 ? prev - 1 : 45));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isGenerating, assets.length, cooldownMessage]);

  const downloadImage = (url: string, index: number) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `design-${index + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderDesignSlot = (index: number) => {
    const asset = assets[index];
    const isCurrent = index === assets.length;

    if (asset) {
      return (
        <div 
          key={index} 
          className="group relative bg-white rounded-2xl overflow-hidden border-2 border-slate-100 cursor-pointer hover:shadow-2xl transition-all"
          onClick={() => setSelectedAsset({ asset, index })}
        >
          <img src={asset.url} alt={`Var ${index + 1}`} className="w-full aspect-square object-contain" />
          <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/20 transition-colors flex flex-col items-center justify-center gap-2">
            <div className="bg-white text-indigo-600 px-4 py-2 rounded-full text-[10px] font-black opacity-0 group-hover:opacity-100 transition-opacity uppercase shadow-lg">
              View
            </div>
            {onEditImage && (
              <button 
                onClick={(e) => { e.stopPropagation(); onEditImage(asset); }}
                className="bg-indigo-600 text-white px-4 py-2 rounded-full text-[10px] font-black opacity-0 group-hover:opacity-100 transition-opacity uppercase shadow-lg"
              >
                Refine
              </button>
            )}
          </div>
        </div>
      );
    }

    if (isCurrent && isGenerating) {
      return (
        <div key={index} className="aspect-square bg-slate-50 rounded-2xl border-2 border-dashed border-indigo-200 flex flex-col items-center justify-center p-4 text-center animate-pulse">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-[10px] font-black text-indigo-600 uppercase">Design #{index + 1}</p>
          <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase">{cooldownMessage || `~${timer}s`}</p>
        </div>
      );
    }

    return (
      <div key={index} className="aspect-square bg-slate-50 rounded-2xl border-2 border-slate-100 flex items-center justify-center text-slate-200">
        <p className="text-[9px] font-black uppercase tracking-widest">Queue</p>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-[2.5rem] shadow-2xl p-6 md:p-12 border border-slate-200 relative">
      {selectedAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/95 p-4 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setSelectedAsset(null)}>
          <div className="relative max-w-4xl w-full flex flex-col items-center gap-6" onClick={(e) => e.stopPropagation()}>
            <div className="bg-white p-2 rounded-[2rem] shadow-2xl w-full max-w-lg">
              <img src={selectedAsset.asset.url} alt="Large Preview" className="w-full rounded-[1.5rem] object-contain" />
            </div>
            <div className="bg-white/10 p-4 rounded-xl text-white text-xs font-mono border border-white/20 w-full text-center backdrop-blur-md">
              "{selectedAsset.asset.prompt}"
            </div>
            <div className="flex gap-4">
              <button onClick={() => setSelectedAsset(null)} className="bg-white/10 text-white px-8 py-4 rounded-xl font-black uppercase">Close</button>
              <button onClick={() => downloadImage(selectedAsset.asset.url, selectedAsset.index)} className="bg-indigo-600 text-white px-8 py-4 rounded-xl font-black uppercase shadow-xl">Download</button>
            </div>
          </div>
        </div>
      )}

      {isGenerating && (
        <div className="bg-indigo-600 text-white px-6 py-4 rounded-2xl mb-12 flex items-center justify-between animate-in slide-in-from-top duration-500 shadow-xl">
          <div className="flex items-center gap-4">
             <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
             <div>
                <p className="font-black text-xs uppercase tracking-widest">Rendering Variation {assets.length + 1}/6</p>
             </div>
          </div>
          {cooldownMessage && <span className="text-[10px] font-black bg-red-500 px-3 py-1 rounded-full animate-pulse uppercase">Quota Limited</span>}
        </div>
      )}

      <div className="flex flex-col gap-12">
        <div className="pb-12 border-b border-slate-100">
          <h4 className="text-xl font-black text-slate-900 mb-8 uppercase tracking-tighter">Premium Asset Variations</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => renderDesignSlot(i))}
          </div>
        </div>

        <div className="prose prose-slate max-w-none">
          <div className="whitespace-pre-wrap font-sans text-slate-800 leading-relaxed text-base">
            {content.split('\n').map((line, i) => {
              if (line.startsWith('|')) return null; 
              if (line.startsWith('**')) return <h3 key={i} className="text-xl font-black mt-10 mb-4 text-slate-900 uppercase tracking-tighter border-b-2 border-indigo-50 pb-2">{line.replace(/\*\*/g, '')}</h3>;
              if (line.startsWith('✅')) return (
                <div key={i} className="flex items-center gap-3 py-2 px-4 bg-slate-50 rounded-xl mb-2 font-bold text-slate-700 border border-slate-100">
                  <span className="text-indigo-600">✓</span> 
                  {line.replace('✅', '')}
                </div>
              );
              if (line.includes('---')) return <hr key={i} className="my-10 border-slate-100" />;
              return <p key={i} className="mb-3">{line}</p>;
            })}
          </div>
        </div>
      </div>

      <div className="mt-12 pt-10 border-t border-slate-100 flex justify-end gap-4">
        <button onClick={() => { navigator.clipboard.writeText(content); alert("Copied!"); }} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black uppercase text-sm">
          Copy Metadata
        </button>
      </div>
    </div>
  );
};

export default KitRenderer;
