
import React, { useState, useRef, useEffect } from 'react';
import { generateKit, generatePreviewImages, editImageWithGemini, analyzeImage } from './services/geminiService';
import KitRenderer from './components/KitRenderer';
import { AppStatus, KitResult, ProductType, GeneratedAsset, ImageSize, AspectRatio } from './types';

interface LoadingStatusProps {
  isUltra: boolean;
  message?: string;
  progress?: { current: number, total: number };
}

const LoadingStatus: React.FC<LoadingStatusProps> = ({ isUltra, message, progress }) => {
  const [messageIndex, setMessageIndex] = useState(0);
  
  const initialMessages = [
    "Waking up the Nano Banana Engine...",
    "Analyzing market trends with Gemini 3...",
    "Conducting SEO keyword research...",
    "Ensuring IP & Copyright compliance...",
    "Drafting your 6 expert design variations...",
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % initialMessages.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center animate-in fade-in duration-300">
      <div className="mb-6 relative">
         <div className={`w-24 h-24 border-4 border-t-indigo-600 rounded-full animate-spin ${isUltra ? 'border-amber-100 border-t-amber-500' : 'border-indigo-100 border-t-indigo-600'}`}></div>
         <div className={`absolute inset-0 flex items-center justify-center text-xs font-black ${isUltra ? 'text-amber-600' : 'text-indigo-600'}`}>
           {isUltra ? 'PRO' : 'NANO'}
         </div>
      </div>
      
      <p className={`font-black h-6 animate-pulse text-xl mb-4 tracking-tight ${isUltra ? 'text-amber-600' : 'text-indigo-600'}`}>
        {message || initialMessages[messageIndex]}
      </p>

      {progress && (
        <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest">
          Progress: {progress.current} / {progress.total}
        </p>
      )}

      <div className="w-full max-w-md bg-slate-100 h-1 rounded-full overflow-hidden mb-6">
        <div 
          className={`h-full transition-all duration-500 ${isUltra ? 'bg-amber-500' : 'bg-indigo-600'}`}
          style={{ width: progress ? `${(progress.current / progress.total) * 100}%` : '100%' }}
        ></div>
      </div>

      <p className="text-slate-400 text-sm italic bg-slate-50 px-6 py-3 rounded-full border border-slate-100">
        Engineered by Google Gemini
      </p>
    </div>
  );
};

const ButtonSpinner = () => (
  <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [inputText, setInputText] = useState('');
  const [productType, setProductType] = useState<ProductType>(ProductType.TSHIRT);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [result, setResult] = useState<KitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPermissionError, setIsPermissionError] = useState(false);
  const [useUltraQuality, setUseUltraQuality] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [thinkingMode, setThinkingMode] = useState(false);
  const [fastMode, setFastMode] = useState(false);
  const [imageSize, setImageSize] = useState<ImageSize>('1K');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [cooldownMessage, setCooldownMessage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSelectPersonalKey = async () => {
    try {
      await (window as any).aistudio.openSelectKey();
      setError(null);
      setIsPermissionError(false);
    } catch (e) {
      console.error("Failed to select key", e);
    }
  };

  const handleAnalyzeImage = async () => {
    if (!imagePreview) return;
    setStatus(AppStatus.LOADING);
    setAnalysisResult(null);
    try {
      const analysis = await analyzeImage(imagePreview);
      setAnalysisResult(analysis);
      setStatus(AppStatus.SUCCESS);
      setResult({ markdown: `**Image Analysis**\n\n${analysis}`, assets: [] });
    } catch (err: any) {
      setError(err.message);
      setStatus(AppStatus.ERROR);
    }
  };

  const extractPrompts = (markdown: string): string[] => {
    const prompts: string[] = [];
    const lines = markdown.split('\n');
    let inTable = false;
    for (const line of lines) {
      if (line.includes('| VARIATION | IMAGE PROMPT |')) { inTable = true; continue; }
      if (inTable && line.includes('|')) {
        const columns = line.split('|');
        if (columns.length >= 3) {
          const prompt = columns[2].trim();
          if (prompt && !prompt.includes('---') && !prompt.includes('IMAGE PROMPT')) {
            prompts.push(prompt.replace(/\*\*/g, ''));
          }
        }
      }
      if (inTable && line.trim() === '' && prompts.length > 0) inTable = false;
    }
    return prompts.slice(0, 6);
  };

  const handleProcess = async () => {
    if (isEditMode) {
      if (!imagePreview || !inputText) {
        setError("Upload an image and type an instruction.");
        return;
      }
      setStatus(AppStatus.LOADING);
      try {
        const editedAssets = await editImageWithGemini(imagePreview, inputText);
        setResult({ markdown: `**AI Edit Results**\n\nInstruction: ${inputText}`, assets: editedAssets });
        setStatus(AppStatus.SUCCESS);
      } catch (err: any) {
        setError(err.message);
        setStatus(AppStatus.ERROR);
      }
      return;
    }

    if (!inputText && !imagePreview) {
      setError("Provide a vision description or upload an image.");
      return;
    }

    if (useUltraQuality) {
      const hasKey = await (window as any).aistudio.hasSelectedApiKey();
      if (!hasKey) {
        setIsPermissionError(true);
        setError("Ultra Pro models require a personal API key.");
        return;
      }
    }

    setStatus(AppStatus.LOADING);
    setError(null);
    setIsGeneratingImages(false);
    
    try {
      const markdown = await generateKit(inputText, productType, { 
        imageBase64: imagePreview || undefined, 
        thinkingMode, 
        fastMode 
      });
      const prompts = extractPrompts(markdown);
      setResult({ markdown, assets: [] });
      setStatus(AppStatus.SUCCESS);
      
      setIsGeneratingImages(true);
      await generatePreviewImages(
        prompts, 
        { useHighQuality: useUltraQuality, size: imageSize, aspectRatio }, 
        (asset) => {
          setResult(prev => prev ? { ...prev, assets: [...prev.assets, asset] } : null);
          setCooldownMessage(null);
        },
        (msg) => setCooldownMessage(msg)
      );
      setIsGeneratingImages(false);
    } catch (err: any) {
      setError(err.message);
      setStatus(AppStatus.ERROR);
    }
  };

  const isLoading = status === AppStatus.LOADING;

  const resetApp = () => {
    setStatus(AppStatus.IDLE);
    setResult(null);
    setError(null);
    setIsGeneratingImages(false);
    setCooldownMessage(null);
    setAnalysisResult(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-10 font-sans text-slate-900">
      <header className="max-w-4xl mx-auto mb-10 text-center">
        <div className="inline-flex items-center justify-center p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200 mb-6 relative">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
          <div className="absolute -top-2 -right-2 bg-amber-400 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full border-2 border-white animate-bounce">GEMINI 3 PRO</div>
        </div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2 uppercase">POD Intelligence Suite</h1>
        <p className="text-slate-500 font-medium italic">High-Fidelity E-commerce Kits powered by Nano Banana Pro</p>
      </header>

      <main className="max-w-4xl mx-auto">
        {status !== AppStatus.SUCCESS ? (
          <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200 border border-slate-200 overflow-hidden relative">
            <div className={`p-8 md:p-12 transition-all ${isLoading ? 'opacity-20 blur-sm pointer-events-none' : 'opacity-100'}`}>
              
              <div className="flex flex-wrap gap-4 justify-between items-center mb-10">
                <div className="flex bg-slate-100 p-1 rounded-2xl">
                  <button onClick={() => setIsEditMode(false)} className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${!isEditMode ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>KIT GEN</button>
                  <button onClick={() => setIsEditMode(true)} className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${isEditMode ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>IMAGE EDITOR</button>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => {setThinkingMode(!thinkingMode); setFastMode(false);}} className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all border-2 ${thinkingMode ? 'bg-purple-50 border-purple-500 text-purple-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>THINK MODE (PRO)</button>
                  <button onClick={() => {setFastMode(!fastMode); setThinkingMode(false);}} className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all border-2 ${fastMode ? 'bg-cyan-50 border-cyan-500 text-cyan-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>FAST MODE (LITE)</button>
                </div>
              </div>

              {!isEditMode && (
                <>
                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <button onClick={() => setProductType(ProductType.TSHIRT)} className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${productType === ProductType.TSHIRT ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-100 text-slate-400'}`}>
                      <span className="font-bold">T-Shirt</span>
                    </button>
                    <button onClick={() => setProductType(ProductType.INVITATION)} className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${productType === ProductType.INVITATION ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-100 text-slate-400'}`}>
                      <span className="font-bold">Invitation</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-3">Image Aspect Ratio</label>
                      <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value as AspectRatio)} className="w-full p-3 rounded-xl border-2 border-slate-100 font-bold bg-slate-50 outline-none focus:border-indigo-500">
                        {['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '21:9'].map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 flex justify-between">
                        Rendering Quality
                        <span onClick={() => setUseUltraQuality(!useUltraQuality)} className={`cursor-pointer ${useUltraQuality ? 'text-amber-500' : 'text-slate-300'}`}>[ PRO MODE ]</span>
                      </label>
                      <select disabled={!useUltraQuality} value={imageSize} onChange={(e) => setImageSize(e.target.value as ImageSize)} className={`w-full p-3 rounded-xl border-2 font-bold bg-slate-50 outline-none ${useUltraQuality ? 'border-amber-200 focus:border-amber-500 text-amber-700' : 'border-slate-100 text-slate-300'}`}>
                        {['1K', '2K', '4K'].map(s => <option key={s} value={s}>{s} Resolution</option>)}
                      </select>
                    </div>
                  </div>
                </>
              )}

              <textarea 
                className="w-full p-6 rounded-3xl border-2 border-slate-100 focus:border-indigo-500 outline-none min-h-[140px] mb-8 text-xl transition-all resize-none shadow-inner" 
                placeholder={isEditMode ? "Describe how to edit the image..." : "Describe your vision..."} 
                value={inputText} 
                onChange={(e) => setInputText(e.target.value)} 
              />

              <div className="mb-4 relative group">
                <div 
                  className="p-8 border-4 border-dashed rounded-[2rem] text-center cursor-pointer hover:bg-slate-50 transition-all border-slate-200" 
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageChange} />
                  {imagePreview ? (
                    <img src={imagePreview} className="max-h-56 mx-auto rounded-3xl shadow-xl border-4 border-white" />
                  ) : (
                    <p className="text-slate-300 font-bold">Drop reference photo here</p>
                  )}
                </div>
                {imagePreview && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleAnalyzeImage(); }}
                    className="absolute bottom-4 right-4 bg-white/90 backdrop-blur shadow-lg border border-slate-200 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all"
                  >
                    Analyze Image
                  </button>
                )}
              </div>
            </div>

            {error && <div className="mx-8 mb-8 p-6 bg-red-50 rounded-2xl text-red-700 font-bold">{error}</div>}
            {isLoading && <LoadingStatus isUltra={useUltraQuality || thinkingMode} message={isEditMode ? "Gemini 2.5 is editing..." : (thinkingMode ? "Gemini 3 Pro is thinking..." : undefined)} />}

            <div className="p-8 md:p-12 pt-0">
              <button disabled={isLoading} onClick={handleProcess} className={`w-full text-white py-6 rounded-3xl font-black text-2xl transition-all flex items-center justify-center gap-4 ${isLoading ? 'bg-slate-300' : 'bg-indigo-600 hover:bg-indigo-700 shadow-xl'}`}>
                {isLoading ? <ButtonSpinner /> : (isEditMode ? "EDIT (6 VARS)" : "GENERATE KIT")}
              </button>
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-10 duration-700">
            <button onClick={resetApp} className="mb-8 font-black text-indigo-600 flex items-center gap-2 hover:translate-x-1 transition-all">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              Go Back
            </button>
            {result && (
              <KitRenderer 
                content={result.markdown} 
                assets={result.assets} 
                isGenerating={isGeneratingImages}
                cooldownMessage={cooldownMessage}
                onEditImage={(asset) => {
                  setImagePreview(asset.url);
                  setInputText("");
                  setIsEditMode(true);
                  setStatus(AppStatus.IDLE);
                }}
              />
            )}
          </div>
        )}
      </main>

      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(30%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};

export default App;
