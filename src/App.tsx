/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Briefcase, 
  MapPin,
  DollarSign,
  FileText, 
  MessageSquare, 
  Map, 
  ChevronRight, 
  Loader2, 
  Send, 
  User, 
  Bot,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Trash2,
  History,
  Shield,
  LogOut,
  LogIn,
  Settings,
  Database,
  Search,
  ExternalLink,
  BarChart3,
  PenTool,
  FileSearch,
  Activity,
  Video,
  Users,
  LayoutDashboard,
  Code2,
  Terminal,
  Cpu,
  FileCode,
  Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { cn } from './lib/utils';
import { handleFirestoreError, OperationType } from './lib/firestore-utils';
import { ResumeUpload } from './components/ResumeUpload';
import { ArchitectureVisualizer } from './components/ArchitectureVisualizer';
import { 
  analyzeResume, 
  getCareerRoadmap, 
  interviewCoach, 
  generalCareerAdvice, 
  matchJobs,
  getMarketAnalysis,
  tailorResumeBullet,
  generateCoverLetter,
  performGapAnalysis,
  performPersonaAudit,
  analyzeInterviewVideo,
  simulateAgentPanel,
  generateInterviewQuestions,
  generateArchitecture,
  analyzeSecurity,
  parseJSON
} from './services/gemini';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  serverTimestamp
} from './firebase';

type Tab = 'dashboard' | 'chat' | 'resume' | 'roadmap' | 'devops' | 'history' | 'admin' | 'settings';

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'admin' | 'user';
}

interface HistoryItem {
  id: string;
  type: string;
  input: string;
  output: string;
  createdAt: any;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [resumeText, setResumeText] = useState('');
  const [jobDesc, setJobDesc] = useState('');
  const [chat, setChat] = useState<{ role: 'user' | 'bot'; text: string; timestamp: Date }[]>([]);
  const [userInput, setUserInput] = useState('');
  const [activeFile, setActiveFile] = useState('main');
  const [roadmapData, setRoadmapData] = useState({ current: '', target: '', skills: '' });
  const [roadmapResult, setRoadmapResult] = useState<any>(null);
  const [gapAnalysis, setGapAnalysis] = useState<{ match_score: number; missing_keywords: string[]; recommended_projects: any[] } | null>(null);
  const [marketAnalysis, setMarketAnalysis] = useState<any>(null);
  const [matchedJobs, setMatchedJobs] = useState<any[]>([]);
  const [coverLetter, setCoverLetter] = useState<string | null>(null);
  const [optimizedBullet, setOptimizedBullet] = useState<string | null>(null);
  const [bulletInput, setBulletInput] = useState('');
  const [jobPreferences, setJobPreferences] = useState({
    location: '',
    salary: '',
    industry: '',
    experienceLevel: '',
    jobType: ''
  });
  const [archPrompt, setArchPrompt] = useState('');
  const [customArch, setCustomArch] = useState<any>(null);
  const [devopsView, setDevopsView] = useState<'code' | 'visual'>('code');
  const [personaAudit, setPersonaAudit] = useState<any>(null);
  const [mockQuestions, setMockQuestions] = useState<any>(null);
  const [panelInterview, setPanelInterview] = useState<any>(null);
  const [videoTranscript, setVideoTranscript] = useState('');
  const [securityAudit, setSecurityAudit] = useState<string | null>(null);
  const [adminSettings, setAdminSettings] = useState({
    primaryModel: 'gemini-3-flash-preview',
    temperature: 0.7,
    latency: 24,
    tokenUsage: 1200
  });
  const [apiSettings, setApiSettings] = useState({
    openRouterKey: localStorage.getItem('openrouter_key') || '',
    openRouterModel: localStorage.getItem('openrouter_model') || 'stepfun/step-3.5-flash:free'
  });
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [devopsFiles, setDevopsFiles] = useState<any>({
    main: { label: 'main.py (FastAPI)', code: `from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import rag_service, uuid

app = FastAPI(title="CareerPath AI v11", version="11.1.0")

app.add_middleware(CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"])

@app.post("/api/chat")
async def chat(request: ChatRequest):
    response_text = rag_service.query_resume(
        request.message,
        request.history,
        user_id=request.user_id
    )
    conv_id = request.conversation_id or str(uuid.uuid4())
    return {"response": response_text, "conversation_id": conv_id}

@app.post("/api/upload_resume")
async def upload_resume(file: UploadFile = File(...)):
    chunk_count = rag_service.process_resume(temp_path, user_id=user_id)
    return {"status": "success", "chunks_processed": chunk_count}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)` },
    rag: { label: 'rag_service.py', code: `from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_pinecone import PineconeVectorStore
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.chains import RetrievalQA

CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200
EMBEDDING_MODEL = "models/text-embedding-004"
LLM_MODEL = "gemini-3-flash-preview"

def process_resume(file_path: str, user_id: str) -> int:
    loader = PyPDFLoader(file_path)
    documents = loader.load()
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP
    )
    chunks = splitter.split_documents(documents)
    # Inject user_id for vector isolation
    for chunk in chunks:
        chunk.metadata["user_id"] = user_id
    embeddings = GoogleGenerativeAIEmbeddings(model=EMBEDDING_MODEL)
    PineconeVectorStore.from_documents(chunks, embeddings)
    return len(chunks)

def query_resume(question, history=None, user_id=None):
    vectorstore = get_vectorstore()
    search_kwargs = {"k": 5, "filter": {"user_id": user_id}}
    qa_chain = RetrievalQA.from_chain_type(llm,
        retriever=vectorstore.as_retriever(search_kwargs=search_kwargs))
    return qa_chain.invoke({"query": question})["result"]` },
    docker: { label: 'docker-compose.yml', code: `version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
    environment:
      - ENV=development
      - PORT=8000
    restart: always

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8000
    depends_on:
      - backend
    restart: always` },
    dockerfile: { label: 'Dockerfile', code: `FROM python:3.10-slim
WORKDIR /app

# Install system deps
RUN apt-get update && apt-get install -y \\
    gcc libffi-dev libssl-dev \\
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY . .

# Expose port
EXPOSE 8000

# Launch FastAPI via uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]` }
  });

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chat]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      try {
        if (firebaseUser) {
          const userRef = doc(db, 'users', firebaseUser.uid);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            setUser(userSnap.data() as UserProfile);
          } else {
            const isDefaultAdmin = firebaseUser.email === 'pravinwaghmare9356@gmail.com';
            const newUser: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || 'User',
              photoURL: firebaseUser.photoURL || '',
              role: isDefaultAdmin ? 'admin' : 'user'
            };
            try {
              await setDoc(userRef, { ...newUser, createdAt: serverTimestamp() });
            } catch (error: any) {
              if (error.message?.includes("insufficient permissions")) {
                handleFirestoreError(error, OperationType.WRITE, `users/${firebaseUser.uid}`);
              } else {
                console.error("Error creating user profile:", error);
              }
            }
            setUser(newUser);
          }
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error("Auth state change error:", error);
        setUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setHistory([]);
      return;
    }

    const q = query(
      collection(db, 'history'),
      where('uid', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as HistoryItem[];
      setHistory(items);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (history.length > 0) {
      // Load latest roadmap if available
      const latestRoadmap = history.find(h => h.type === 'roadmap');
      if (latestRoadmap && !roadmapResult) {
        const parsed = parseJSON(latestRoadmap.output);
        if (parsed) {
          setRoadmapResult(parsed);
        } else {
          console.error("Failed to parse roadmap from history");
        }
      }

      // Load latest gap analysis if available
      const latestGap = history.find(h => h.type === 'gap-analysis');
      if (latestGap && !gapAnalysis) {
        const parsed = parseJSON(latestGap.output);
        if (parsed) {
          setGapAnalysis(parsed);
        } else {
          console.error("Failed to parse gap analysis from history");
        }
      }

      const latestPersona = history.find(h => h.type === 'persona-audit');
      if (latestPersona && !personaAudit) {
        const audit = parseJSON(latestPersona.output);
        if (audit) {
          setPersonaAudit({
            recruiter: audit.recruiter_score,
            techLead: audit.tech_lead_score,
            recruiterFeedback: audit.recruiter_feedback,
            techLeadFeedback: audit.tech_lead_feedback
          });
        } else {
          console.error("Failed to parse persona audit from history");
        }
      }
      const latestMarket = history.find(h => h.type === 'market-analysis');
      if (latestMarket && !marketAnalysis) {
        const parsed = parseJSON(latestMarket.output);
        if (parsed) {
          setMarketAnalysis(parsed);
        } else {
          console.error("Failed to parse market analysis from history");
        }
      }

      const latestMockQuestions = history.find(h => h.type === 'mock-questions');
      if (latestMockQuestions && !mockQuestions) {
        const parsed = parseJSON(latestMockQuestions.output);
        if (parsed) {
          setMockQuestions(parsed);
        } else {
          console.error("Failed to parse mock questions from history");
        }
      }

      const latestPanel = history.find(h => h.type === 'panel-interview');
      if (latestPanel && !panelInterview) {
        const parsed = parseJSON(latestPanel.output);
        if (parsed) {
          setPanelInterview(parsed);
        } else {
          console.error("Failed to parse panel interview from history");
        }
      }
    }
  }, [history]);

  const [loginError, setLoginError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoginError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Login failed:", error);
      setLoginError(error.message || "Login failed. Please try again.");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setActiveTab('dashboard');
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const handleResumeAnalysis = async () => {
    if (!resumeText.trim()) return;
    setLoading(true);
    try {
      // 1. Quick Analysis
      const res = await analyzeResume(resumeText, apiSettings);
      setResult(res || "No analysis generated.");
      
      // 2. Persona Audit
      const audit = await performPersonaAudit(resumeText, undefined, apiSettings);
      setPersonaAudit({
        recruiter: audit.recruiter_score,
        techLead: audit.tech_lead_score,
        recruiterFeedback: audit.recruiter_feedback,
        techLeadFeedback: audit.tech_lead_feedback
      });
    } catch (error) {
      console.error(error);
      setResult("Error analyzing resume.");
    }
    setLoading(false);
  };

  const handleFullAudit = async () => {
    if (!resumeText.trim() || !jobDesc.trim()) {
      alert("Please provide both a resume and a target job description for a full audit.");
      return;
    }
    setLoading(true);
    try {
      // 1. Gap Analysis
      const gap = await performGapAnalysis(resumeText, jobDesc, apiSettings);
      setGapAnalysis(gap);
      
      // 2. Persona Audit with JD context
      const audit = await performPersonaAudit(resumeText, jobDesc, apiSettings);
      setPersonaAudit({
        recruiter: audit.recruiter_score,
        techLead: audit.tech_lead_score,
        recruiterFeedback: audit.recruiter_feedback,
        techLeadFeedback: audit.tech_lead_feedback
      });
    } catch (error) {
      console.error(error);
      alert("Audit failed. Check console for details.");
    }
    setLoading(false);
  };

  const handleRoadmapGeneration = async () => {
    if (!roadmapData.current || !roadmapData.target) return;
    setLoading(true);
    setRoadmapResult(null);
    try {
      const res = await getCareerRoadmap(roadmapData.current, roadmapData.target, roadmapData.skills, apiSettings);
      if (res && typeof res === 'object') {
        setRoadmapResult(res);
      } else {
        throw new Error("Invalid roadmap data received.");
      }
    } catch (error) {
      console.error(error);
      alert("Failed to generate roadmap. Please try again.");
    }
    setLoading(false);
  };

  const handleJobMatch = async () => {
    if (!resumeText.trim()) return;
    setLoading(true);
    try {
      const matches = await matchJobs(resumeText, jobPreferences, apiSettings);
      setMatchedJobs(matches);
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  const handleCoverLetter = async () => {
    if (!resumeText.trim() || !jobDesc.trim()) return;
    setLoading(true);
    try {
      const cl = await generateCoverLetter(resumeText, jobDesc, apiSettings);
      setCoverLetter(cl);
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  const handleMarketAnalysis = async () => {
    if (!roadmapData.target) return;
    setLoading(true);
    try {
      const analysis = await getMarketAnalysis("Technology", "Mid-Level", roadmapData.target, apiSettings);
      setMarketAnalysis(analysis);
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  const handleMockQuestions = async () => {
    if (!jobDesc) return;
    setLoading(true);
    try {
      const questions = await generateInterviewQuestions("Technology", "Mid-Level", jobDesc, apiSettings);
      setMockQuestions(questions);
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  const handleOptimizeBullet = async () => {
    if (!bulletInput.trim()) return;
    setLoading(true);
    try {
      const optimized = await tailorResumeBullet(bulletInput, jobDesc || "Software Engineer", apiSettings);
      setOptimizedBullet(optimized);
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  const handlePanelInterview = async () => {
    if (!jobDesc) return;
    setLoading(true);
    try {
      const panel = await simulateAgentPanel(resumeText, jobDesc, apiSettings);
      setPanelInterview(panel);
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  const handleVideoAnalysis = async () => {
    if (!videoTranscript.trim()) {
      alert("Please provide a transcript or notes for analysis.");
      return;
    }
    setLoading(true);
    try {
      const analysis = await analyzeInterviewVideo(videoTranscript, apiSettings);
      setResult(analysis);
      setVideoTranscript('');
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  const handleSecurityScan = async () => {
    const code = devopsFiles[activeFile as keyof typeof devopsFiles]?.code || devopsFiles[activeFile as keyof typeof devopsFiles];
    if (!code) return;
    setLoading(true);
    try {
      const audit = await analyzeSecurity(typeof code === 'string' ? code : JSON.stringify(code), activeFile, apiSettings);
      setSecurityAudit(audit);
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  const handleGenerateArch = async () => {
    if (!archPrompt.trim()) return;
    setLoading(true);
    try {
      const arch = await generateArchitecture(archPrompt, apiSettings);
      setCustomArch(arch);
      
      // Update devopsFiles with generated content
      if (arch.files && arch.files.length > 0) {
        const newFiles: any = { ...devopsFiles };
        arch.files.forEach((file: any) => {
          newFiles[file.name] = { label: file.name, code: file.content };
        });
        setDevopsFiles(newFiles);
        setActiveFile(arch.files[0].name);
        if (arch.structure) setDevopsView('visual');
      }
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  const handleInterviewChat = async () => {
    if (!userInput.trim()) return;
    const newChat = [...chat, { role: 'user' as const, text: userInput, timestamp: new Date() }];
    setChat(newChat);
    setUserInput('');
    setLoading(true);
    try {
      const context = chat.map(c => `${c.role}: ${c.text}`);
      const res = await interviewCoach(jobDesc, userInput, context, apiSettings);
      setChat([...newChat, { role: 'bot' as const, text: res || "I'm sorry, I couldn't process that.", timestamp: new Date() }]);
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  const renderDashboard = () => (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold text-emerald-primary uppercase tracking-[0.2em] mb-2">Workspace / Overview</p>
          <h2 className="text-3xl font-bold text-text-primary tracking-tight">Welcome back, {user?.displayName?.split(' ')[0]}</h2>
          <p className="text-sm text-text-secondary mt-1">Here's what's happening with your career transition today.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">
                {String.fromCharCode(64 + i)}
              </div>
            ))}
          </div>
          <p className="text-xs font-medium text-text-secondary">3 active AI agents monitoring</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="stat-card group">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
              <Activity size={20} />
            </div>
            <span className="text-[10px] font-bold text-emerald-primary bg-emerald-dim px-2 py-1 rounded uppercase tracking-wider">FAANG Level</span>
          </div>
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider">Match Score</p>
          <div className="flex items-baseline gap-1 mt-1">
            <h3 className="text-3xl font-bold text-text-primary tracking-tighter">{gapAnalysis?.match_score || 0}%</h3>
            <span className="text-xs font-bold text-emerald-primary">+2.4%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full mt-4 overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${gapAnalysis?.match_score || 0}%` }}
              className="h-full bg-emerald-primary"
            />
          </div>
        </div>

        <div className="stat-card group">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
              <Map size={20} />
            </div>
          </div>
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider">Roadmap Progress</p>
          <div className="flex items-baseline gap-1 mt-1">
            <h3 className="text-3xl font-bold text-text-primary tracking-tighter">{roadmapResult?.phases?.length || 0} Phases</h3>
          </div>
          <p className="text-[11px] text-text-secondary mt-3 line-clamp-1">Next: {roadmapResult?.phases?.[0]?.topic || 'Not started'}</p>
        </div>

        <div className="stat-card group">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform">
              <History size={20} />
            </div>
          </div>
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider">Total Activity</p>
          <div className="flex items-baseline gap-1 mt-1">
            <h3 className="text-3xl font-bold text-text-primary tracking-tighter">{history.length}</h3>
          </div>
          <p className="text-[11px] text-text-secondary mt-3">Transmissions logged</p>
        </div>

        <div className="stat-card group">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
              <CheckCircle2 size={20} />
            </div>
          </div>
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider">System Status</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="text-xl font-bold text-text-primary tracking-tight">Operational</h3>
          </div>
          <p className="text-[11px] text-text-secondary mt-3">All nodes active</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-text-primary">Recent Activity</h3>
            <button onClick={() => setActiveTab('history')} className="text-xs font-bold text-emerald-primary hover:underline">View all history</button>
          </div>
          <div className="space-y-3">
            {history.slice(0, 3).map((item) => (
              <div key={item.id} className="flex items-center gap-4 p-4 bg-white border border-border rounded-2xl hover:border-emerald-primary/30 transition-all group cursor-pointer">
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105",
                  item.type === 'resume' ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"
                )}>
                  {item.type === 'resume' ? <FileText size={20} /> : <Map size={20} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-bold text-text-primary capitalize">{item.type} Analysis</h4>
                    <span className="text-[10px] font-medium text-text-muted">{item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString() : 'Just now'}</span>
                  </div>
                  <p className="text-xs text-text-secondary line-clamp-1 italic">"{item.input}"</p>
                </div>
                <ChevronRight size={16} className="text-text-muted group-hover:text-emerald-primary transition-colors" />
              </div>
            ))}
            {history.length === 0 && (
              <div className="text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                <History className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                <p className="text-sm text-slate-500 font-medium">No activity yet. Start by uploading your resume.</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="text-lg font-bold text-text-primary">Quick Actions</h3>
          <div className="grid grid-cols-1 gap-3">
            <button onClick={() => setActiveTab('resume')} className="flex items-center gap-3 p-4 bg-emerald-primary text-white rounded-2xl hover:bg-emerald-dark transition-all shadow-lg shadow-emerald-primary/20 group">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <FileSearch size={20} />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold">Resume Audit</p>
                <p className="text-[10px] opacity-80">Get AI feedback on your resume</p>
              </div>
            </button>
            <button onClick={() => setActiveTab('chat')} className="flex items-center gap-3 p-4 bg-white border border-border rounded-2xl hover:border-emerald-primary/30 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <MessageSquare size={20} />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-text-primary">AI Career Coach</p>
                <p className="text-[10px] text-text-secondary">Chat with your career mentor</p>
              </div>
            </button>
            <button onClick={() => setActiveTab('roadmap')} className="flex items-center gap-3 p-4 bg-white border border-border rounded-2xl hover:border-emerald-primary/30 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Map size={20} />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-text-primary">Skill Growth</p>
                <p className="text-[10px] text-text-secondary">Map your path to success</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAICoach = () => (
    <div className="flex flex-col h-[calc(100vh-12rem)] max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-[10px] font-bold text-emerald-primary uppercase tracking-[0.2em] mb-1">AI Mentor</p>
          <h2 className="text-2xl font-bold text-text-primary tracking-tight">Career Architect</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-dim rounded-full border border-emerald-primary/10">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-emerald-primary uppercase tracking-widest">Context: Active</span>
          </div>
          {chat.length > 0 && (
            <button 
              onClick={() => setChat([])} 
              className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold text-red-500 uppercase tracking-widest hover:bg-red-50 rounded-full transition-all border border-red-100/50 hover:border-red-200"
              title="Clear all messages"
            >
              <Trash2 size={14} />
              Clear Chat
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6 mb-6 pr-4 scrollbar-thin scrollbar-thumb-slate-200">
        <div className="flex gap-4 items-start">
          <div className="w-10 h-10 rounded-2xl bg-emerald-primary flex items-center justify-center text-white shadow-lg shadow-emerald-primary/20 shrink-0">
            <Bot size={20} />
          </div>
          <div className="bg-white border border-border rounded-2xl rounded-tl-none p-4 text-sm leading-relaxed text-text-secondary shadow-sm max-w-[85%]">
            Hello! I'm your AI Career Coach. I can help you with interview preparation, skill gap analysis, or general career advice. How can I assist you today?
          </div>
        </div>

        {chat.map((msg, i) => (
          <div key={i} className={cn("flex gap-4 items-start", msg.role === 'user' ? "flex-row-reverse" : "")}>
            <div className={cn(
              "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-lg transition-transform hover:scale-105 overflow-hidden",
              msg.role === 'user' ? "bg-slate-800 text-white shadow-slate-800/20" : "bg-emerald-primary text-white shadow-emerald-primary/20"
            )}>
              {msg.role === 'user' ? (
                user?.photoURL ? <img src={user.photoURL} alt="User" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <User size={20} />
              ) : <Bot size={20} />}
            </div>
            <div className="flex flex-col gap-1 max-w-[85%]">
              <div className={cn(
                "p-4 text-sm leading-relaxed shadow-sm rounded-2xl",
                msg.role === 'user' ? "bg-emerald-primary text-white rounded-tr-none" : "bg-white border border-border rounded-tl-none text-text-secondary"
              )}>
                <div className="prose prose-sm prose-slate max-w-none prose-p:leading-relaxed">
                  <ReactMarkdown>
                    {msg.text}
                  </ReactMarkdown>
                </div>
              </div>
              <span className={cn(
                "text-[9px] font-bold text-text-muted uppercase tracking-widest",
                msg.role === 'user' ? "text-right" : "text-left"
              )}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-4 items-start">
            <div className="w-10 h-10 rounded-2xl bg-emerald-primary flex items-center justify-center text-white shadow-lg shadow-emerald-primary/20 shrink-0 animate-pulse">
              <Bot size={20} />
            </div>
            <div className="flex flex-col gap-1">
              <div className="bg-white border border-border rounded-2xl rounded-tl-none p-4 shadow-sm">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-primary animate-bounce" />
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-primary animate-bounce [animation-delay:0.2s]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-primary animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
              <span className="text-[9px] font-bold text-emerald-primary uppercase tracking-widest animate-pulse">
                Bot is thinking...
              </span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Video Transcript / Interview Notes</label>
            {videoTranscript && (
              <button onClick={() => setVideoTranscript('')} className="text-[9px] text-red-500 hover:underline">Clear</button>
            )}
          </div>
          <textarea 
            className="input-field text-xs min-h-[60px] resize-none py-2"
            placeholder="Paste your interview transcript or notes here for AI analysis..."
            value={videoTranscript}
            onChange={(e) => setVideoTranscript(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={handleMockQuestions} className="px-3 py-1.5 bg-slate-50 border border-border rounded-full text-[10px] font-bold text-text-secondary uppercase tracking-widest hover:bg-emerald-dim hover:text-emerald-primary hover:border-emerald-primary/20 transition-all">
            Generate Mock Questions
          </button>
          <button onClick={handlePanelInterview} disabled={!jobDesc} className="px-3 py-1.5 bg-slate-50 border border-border rounded-full text-[10px] font-bold text-text-secondary uppercase tracking-widest hover:bg-emerald-dim hover:text-emerald-primary hover:border-emerald-primary/20 transition-all disabled:opacity-50">
            Simulate Panel Interview
          </button>
          <button onClick={handleVideoAnalysis} disabled={loading || !videoTranscript.trim()} className="px-3 py-1.5 bg-slate-50 border border-border rounded-full text-[10px] font-bold text-text-secondary uppercase tracking-widest hover:bg-emerald-dim hover:text-emerald-primary hover:border-emerald-primary/20 transition-all disabled:opacity-50">
            {loading ? <Loader2 className="w-3 h-3 animate-spin inline mr-1" /> : <Video size={12} className="inline mr-1" />}
            Analyze Interview
          </button>
        </div>

        <div className="relative flex items-center gap-3">
          <input 
            className="flex-1 bg-white border border-border rounded-2xl px-6 py-4 text-sm outline-none focus:border-emerald-primary focus:ring-4 focus:ring-emerald-primary/5 transition-all shadow-sm"
            placeholder="Type your message here..."
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleInterviewChat()}
          />
          <button 
            onClick={handleInterviewChat}
            disabled={loading || !userInput.trim()}
            className="w-14 h-14 bg-emerald-primary text-white rounded-2xl flex items-center justify-center hover:bg-emerald-dark transition-all shadow-lg shadow-emerald-primary/20 disabled:opacity-50 shrink-0 active:scale-95"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );

  const renderResumeLab = () => (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold text-emerald-primary uppercase tracking-[0.2em] mb-2">Workspace / Intelligence</p>
          <h2 className="text-3xl font-bold text-text-primary tracking-tight">Resume Lab</h2>
          <p className="text-sm text-text-secondary mt-1">Audit, optimize, and tailor your resume for any role.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="stat-card">
            <h3 className="text-lg font-bold text-text-primary mb-6 flex items-center gap-2">
              <FileSearch className="text-emerald-primary" size={20} />
              Resume Analysis
            </h3>
            
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 block">Resume Content</label>
                <ResumeUpload 
                  onUpload={(text) => setResumeText(text)} 
                  currentText={resumeText} 
                  loading={loading}
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 block">Target Job Description</label>
                <textarea 
                  className="input-field min-h-[120px] resize-none"
                  placeholder="Paste the job description here to enable gap analysis and tailoring..."
                  value={jobDesc}
                  onChange={(e) => setJobDesc(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button 
                  onClick={handleResumeAnalysis}
                  disabled={loading || !resumeText.trim()}
                  className="btn-secondary"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles size={16} />}
                  Quick AI Audit
                </button>
                <button 
                  onClick={handleFullAudit}
                  disabled={loading || !resumeText.trim() || !jobDesc.trim()}
                  className="btn-primary"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield size={16} />}
                  Full Agentic Audit
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="stat-card">
              <h4 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
                <PenTool size={16} className="text-blue-500" />
                Cover Letter
              </h4>
              <p className="text-xs text-text-secondary mb-4">Generate a professional cover letter tailored to your resume and the job description.</p>
              <button 
                onClick={handleCoverLetter}
                disabled={loading || !resumeText.trim() || !jobDesc.trim()}
                className="btn-secondary py-2 text-xs"
              >
                Generate Letter
              </button>
            </div>
            <div className="stat-card">
              <h4 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
                <Search size={16} className="text-emerald-500" />
                Job Matching
              </h4>
              <div className="space-y-3 mb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input 
                    className="input-field py-1.5 text-[10px]"
                    placeholder="Preferred Location (e.g., Remote, NY)"
                    value={jobPreferences.location}
                    onChange={(e) => setJobPreferences({ ...jobPreferences, location: e.target.value })}
                  />
                  <input 
                    className="input-field py-1.5 text-[10px]"
                    placeholder="Salary Expectation (e.g., $150k+)"
                    value={jobPreferences.salary}
                    onChange={(e) => setJobPreferences({ ...jobPreferences, salary: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select 
                    className="input-field py-1.5 text-[10px]"
                    value={jobPreferences.experienceLevel}
                    onChange={(e) => setJobPreferences({ ...jobPreferences, experienceLevel: e.target.value })}
                  >
                    <option value="">Experience Level</option>
                    <option value="internship">Internship</option>
                    <option value="entry">Entry Level</option>
                    <option value="mid">Mid-Level</option>
                    <option value="senior">Senior</option>
                    <option value="lead">Lead/Manager</option>
                  </select>
                  <select 
                    className="input-field py-1.5 text-[10px]"
                    value={jobPreferences.jobType}
                    onChange={(e) => setJobPreferences({ ...jobPreferences, jobType: e.target.value })}
                  >
                    <option value="">Job Type</option>
                    <option value="full-time">Full-time</option>
                    <option value="contract">Contract</option>
                    <option value="part-time">Part-time</option>
                    <option value="freelance">Freelance</option>
                  </select>
                </div>
                <input 
                  className="input-field py-1.5 text-[10px]"
                  placeholder="Industry (e.g., Fintech, AI, Health)"
                  value={jobPreferences.industry}
                  onChange={(e) => setJobPreferences({ ...jobPreferences, industry: e.target.value })}
                />
              </div>
              <p className="text-xs text-text-secondary mb-4">Find roles that match your skills and preferences using our vector database.</p>
              <div className="flex gap-2">
                <button 
                  onClick={handleJobMatch}
                  disabled={loading || !resumeText.trim()}
                  className="btn-secondary flex-1 py-2 text-xs"
                >
                  Find Matches
                </button>
                <button 
                  onClick={() => setJobPreferences({ location: '', salary: '', industry: '', experienceLevel: '', jobType: '' })}
                  className="p-2 border border-border rounded-xl hover:bg-slate-50 transition-colors"
                  title="Clear Preferences"
                >
                  <Trash2 size={14} className="text-text-muted" />
                </button>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <h4 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
              <Cpu size={16} className="text-purple-500" />
              Bullet Point Optimizer
            </h4>
            <div className="flex gap-3">
              <input 
                className="input-field flex-1"
                placeholder="Paste a resume bullet point to optimize..."
                value={bulletInput}
                onChange={(e) => setBulletInput(e.target.value)}
              />
              <button 
                onClick={handleOptimizeBullet}
                disabled={loading || !bulletInput.trim()}
                className="btn-primary w-auto px-6"
              >
                Optimize
              </button>
            </div>
            {optimizedBullet && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-4 p-4 bg-emerald-dim border border-emerald-primary/20 rounded-xl"
              >
                <p className="text-xs font-medium text-emerald-primary italic">"{optimizedBullet}"</p>
              </motion.div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="stat-card">
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-1">Recruiter POV</p>
                <h4 className="text-lg font-bold text-text-primary">Persona Audit</h4>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-xl font-black text-blue-600">
                {personaAudit?.recruiter || 0}
              </div>
            </div>
            <div className="p-4 bg-slate-50 border border-border rounded-2xl">
              <p className="text-xs text-text-secondary leading-relaxed italic">
                {personaAudit?.recruiterFeedback || "Run an audit to see how a recruiter views your profile."}
              </p>
            </div>
          </div>

          <div className="stat-card">
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="text-[10px] font-bold text-emerald-primary uppercase tracking-widest mb-1">Tech Lead POV</p>
                <h4 className="text-lg font-bold text-text-primary">Technical Audit</h4>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-dim border border-emerald-primary/10 flex items-center justify-center text-xl font-black text-emerald-primary">
                {personaAudit?.techLead || 0}
              </div>
            </div>
            <div className="p-4 bg-slate-50 border border-border rounded-2xl">
              <p className="text-xs text-text-secondary leading-relaxed italic">
                {personaAudit?.techLeadFeedback || "Run an audit to see how a technical leader views your skills."}
              </p>
            </div>
          </div>

          {gapAnalysis && (
            <div className="stat-card border-emerald-primary/20">
              <h4 className="text-sm font-bold text-text-primary mb-4">Gap Analysis</h4>
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Missing Keywords</p>
                  <div className="flex flex-wrap gap-1.5">
                    {gapAnalysis.missing_keywords?.map(k => (
                      <span key={k} className="px-2 py-1 bg-red-50 text-red-600 text-[10px] font-bold rounded border border-red-100">{k}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Recommended Projects</p>
                  <div className="space-y-2">
                    {gapAnalysis.recommended_projects?.slice(0, 2).map((p, i) => (
                      <div key={i} className="p-3 bg-white border border-border rounded-xl">
                        <p className="text-xs font-bold text-text-primary">{p.title}</p>
                        <p className="text-[10px] text-text-secondary mt-1">{p.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {matchedJobs.length > 0 && (
        <div className="stat-card">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-text-primary">Vector-Matched Opportunities</h3>
              <p className="text-xs text-text-secondary mt-1">Top {matchedJobs.length} roles matching your profile and preferences.</p>
            </div>
            <button onClick={() => setMatchedJobs([])} className="text-text-muted hover:text-red-500 p-2"><Trash2 size={18} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {matchedJobs.map((job, i) => (
              <div key={i} className="p-6 bg-white border border-border rounded-2xl hover:border-emerald-primary/30 hover:shadow-lg transition-all group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-primary/5 rounded-bl-full -mr-12 -mt-12 transition-all group-hover:bg-emerald-primary/10" />
                
                <div className="flex justify-between items-start mb-4 relative">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-text-primary group-hover:text-emerald-primary transition-colors truncate pr-2">
                      {job.metadata?.title || 'System Architect'}
                    </h4>
                    <p className="text-xs text-text-secondary mt-1">{job.metadata?.company || 'Neural Corp'}</p>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black text-emerald-primary bg-emerald-dim px-2 py-1 rounded-lg border border-emerald-primary/10">
                      {(job.score * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                <div className="space-y-3 mb-6 relative">
                  <div className="flex items-center gap-2 text-[10px] text-text-muted">
                    <MapPin size={12} className="text-emerald-primary" />
                    <span>{job.metadata?.location || 'Remote / Global'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-text-muted">
                    <Briefcase size={12} className="text-emerald-primary" />
                    <span>{job.metadata?.type || 'Full-time'}</span>
                  </div>
                  {job.metadata?.salary && (
                    <div className="flex items-center gap-2 text-[10px] text-text-muted">
                      <DollarSign size={12} className="text-emerald-primary" />
                      <span>{job.metadata?.salary}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-1 mb-6">
                  {(job.metadata?.skills || ['AI', 'Cloud', 'DevOps']).slice(0, 3).map((skill: string) => (
                    <span key={skill} className="px-2 py-0.5 bg-slate-50 text-text-muted text-[9px] font-bold rounded border border-border">
                      {skill}
                    </span>
                  ))}
                </div>

                <button className="btn-primary w-full py-2.5 text-[10px] uppercase tracking-widest font-black shadow-none hover:shadow-emerald-primary/20">
                  View Full Details
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {coverLetter && (
        <div className="stat-card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-text-primary">Tailored Cover Letter</h3>
            <button onClick={() => setCoverLetter(null)} className="text-text-muted hover:text-red-500"><Trash2 size={18} /></button>
          </div>
          <div className="p-8 bg-slate-50 border border-border rounded-2xl text-sm leading-relaxed text-text-secondary whitespace-pre-wrap font-serif">
            {coverLetter}
          </div>
        </div>
      )}
    </div>
  );

  const renderRoadmap = () => (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold text-emerald-primary uppercase tracking-[0.2em] mb-2">Workspace / Growth</p>
          <h2 className="text-3xl font-bold text-text-primary tracking-tight">Career Roadmap</h2>
          <p className="text-sm text-text-secondary mt-1">Strategic path to your next major career milestone.</p>
        </div>
      </div>

      <div className="stat-card">
        <h3 className="text-lg font-bold text-text-primary mb-6 flex items-center gap-2">
          <Map size={20} className="text-emerald-primary" />
          Map Your Path
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 block">Current Role</label>
            <input 
              className="input-field"
              placeholder="e.g. Junior Developer"
              value={roadmapData.current}
              onChange={(e) => setRoadmapData({ ...roadmapData, current: e.target.value })}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 block">Target Role</label>
            <input 
              className="input-field"
              placeholder="e.g. Senior DevOps Engineer"
              value={roadmapData.target}
              onChange={(e) => setRoadmapData({ ...roadmapData, target: e.target.value })}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 block">Current Skills</label>
            <input 
              className="input-field"
              placeholder="e.g. React, Node, SQL"
              value={roadmapData.skills}
              onChange={(e) => setRoadmapData({ ...roadmapData, skills: e.target.value })}
            />
          </div>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={handleRoadmapGeneration}
            disabled={loading || !roadmapData.target}
            className="btn-primary flex-1"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles size={16} />}
            Generate Strategic Path
          </button>
          <button 
            onClick={handleMarketAnalysis}
            disabled={loading || !roadmapData.target}
            className="btn-secondary flex-1"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 size={16} />}
            Analyze Market Demand
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="stat-card h-full">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-bold text-text-primary">Strategic Phases</h3>
              <div className="text-[10px] font-bold text-emerald-primary bg-emerald-dim px-3 py-1 rounded-full uppercase tracking-widest">
                {roadmapResult?.phases?.length || 0} Phases Total
              </div>
            </div>

            <div className="relative pl-8 space-y-8">
              <div className="absolute left-3 top-2 bottom-2 w-px bg-slate-100" />
              {roadmapResult?.phases?.map((phase: any, i: number) => (
                <div key={i} className="relative">
                  <div className={cn(
                    "absolute -left-8 top-0 w-6 h-6 rounded-lg border-2 border-white flex items-center justify-center text-[10px] font-bold shadow-sm transition-all",
                    i === 0 ? "bg-emerald-primary text-white scale-110" : "bg-slate-100 text-slate-400"
                  )}>
                    {i + 1}
                  </div>
                  <div className="bg-white border border-border rounded-2xl p-6 hover:border-emerald-primary/30 transition-all group">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Phase 0{i+1}</span>
                      <span className="text-[10px] font-bold text-text-muted font-mono">{phase.week}</span>
                    </div>
                    <h4 className="text-lg font-bold text-text-primary mb-2 group-hover:text-emerald-primary transition-colors">{phase.topic}</h4>
                    <p className="text-sm text-text-secondary leading-relaxed mb-4">{phase.milestone}</p>
                    <div className="flex flex-wrap gap-2">
                      {phase.resources?.map((link: string, j: number) => (
                        <a key={j} href={link} target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-slate-50 border border-border rounded-lg text-[10px] font-bold text-text-secondary hover:text-emerald-primary hover:border-emerald-primary/20 transition-all flex items-center gap-1.5">
                          <ExternalLink size={12} />
                          Resource {j+1}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              {(!roadmapResult || !roadmapResult.phases) && (
                <div className="text-center py-20">
                  <Map className="w-16 h-16 mx-auto mb-4 text-slate-200" />
                  <p className="text-sm text-slate-400 font-medium">Generate your roadmap to see the strategic path.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {marketAnalysis && (
            <div className="stat-card border-blue-500/20">
              <h4 className="text-sm font-bold text-text-primary mb-6 flex items-center gap-2">
                <BarChart3 size={18} className="text-blue-500" />
                Market Intelligence
              </h4>
              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Demand Score</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-blue-600">{marketAnalysis.demand_score}</span>
                    <span className="text-xs font-bold text-text-muted">/100</span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Salary Range</p>
                  <p className="text-sm font-bold text-text-primary">{marketAnalysis.salary_range.min} - {marketAnalysis.salary_range.max}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Market Outlook</p>
                  <p className="text-xs text-text-secondary leading-relaxed">{marketAnalysis.market_outlook}</p>
                </div>
              </div>
            </div>
          )}

          <div className="stat-card">
            <h4 className="text-sm font-bold text-text-primary mb-4">Skill Gap Focus</h4>
            <div className="flex flex-wrap gap-2">
              {gapAnalysis?.missing_keywords?.map(s => (
                <span key={s} className="chip">{s}</span>
              )) || ['Kubernetes', 'Terraform', 'Go', 'System Design'].map(s => (
                <span key={s} className="chip">{s}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDevOps = () => (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold text-emerald-primary uppercase tracking-[0.2em] mb-2">Workspace / Engineering</p>
          <h2 className="text-3xl font-bold text-text-primary tracking-tight">DevOps Center</h2>
          <p className="text-sm text-text-secondary mt-1">AI-powered architecture design and infrastructure as code.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-4">
          <div className="stat-card">
            <h4 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-4">Architecture Files</h4>
            <div className="space-y-1 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin">
              {Object.keys(devopsFiles).map((fileName) => (
                <button
                  key={fileName}
                  onClick={() => setActiveFile(fileName)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all",
                    activeFile === fileName 
                      ? "bg-emerald-dim text-emerald-primary border border-emerald-primary/20" 
                      : "text-text-secondary hover:bg-slate-50 border border-transparent"
                  )}
                >
                  <FileCode size={14} />
                  {fileName}
                </button>
              ))}
            </div>
          </div>
          
          <div className="stat-card">
            <h4 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-4">Infrastructure Actions</h4>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 block">Architecture Prompt</label>
                <textarea 
                  className="input-field text-xs min-h-[80px] resize-none"
                  placeholder="e.g. AWS EKS with Terraform and CI/CD pipeline..."
                  value={archPrompt}
                  onChange={(e) => setArchPrompt(e.target.value)}
                />
              </div>
              <button onClick={handleGenerateArch} disabled={loading || !archPrompt.trim()} className="btn-primary py-2 text-[10px] w-full">
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Cpu size={14} />}
                Generate Architecture
              </button>
              <button 
                onClick={handleSecurityScan} 
                disabled={loading} 
                className={cn(
                  "btn-secondary py-2 text-[10px] w-full",
                  securityAudit && "border-emerald-primary/30 bg-emerald-dim text-emerald-primary"
                )}
              >
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Shield size={14} />}
                Security Scan
              </button>
              {securityAudit && (
                <button onClick={() => setSecurityAudit(null)} className="text-[9px] text-red-500 hover:underline w-full text-center">
                  Clear Audit
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-6">
          <div className="stat-card h-full min-h-[500px] flex flex-col p-0 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-slate-50/50">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white border border-border flex items-center justify-center text-emerald-primary">
                    <Terminal size={16} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-text-primary">{devopsView === 'code' ? activeFile : 'Architecture Visualizer'}</h4>
                    <p className="text-[10px] text-text-muted font-mono">{devopsView === 'code' ? 'HCL / YAML / JSON / Python' : 'System Blueprint'}</p>
                  </div>
                </div>
                
                {customArch?.structure && (
                  <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button 
                      onClick={() => setDevopsView('code')}
                      className={cn(
                        "px-3 py-1 text-[10px] font-bold rounded-md transition-all",
                        devopsView === 'code' ? "bg-white text-emerald-primary shadow-sm" : "text-text-muted hover:text-text-primary"
                      )}
                    >
                      CODE
                    </button>
                    <button 
                      onClick={() => setDevopsView('visual')}
                      className={cn(
                        "px-3 py-1 text-[10px] font-bold rounded-md transition-all",
                        devopsView === 'visual' ? "bg-white text-emerald-primary shadow-sm" : "text-text-muted hover:text-text-primary"
                      )}
                    >
                      VISUAL
                    </button>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    const code = devopsFiles[activeFile as keyof typeof devopsFiles]?.code || devopsFiles[activeFile as keyof typeof devopsFiles];
                    navigator.clipboard.writeText(typeof code === 'string' ? code : JSON.stringify(code, null, 2));
                  }}
                  className="p-2 text-text-muted hover:text-emerald-primary transition-colors"
                  title="Copy to clipboard"
                >
                  <Copy size={16} />
                </button>
              </div>
            </div>
            
            <div className={cn(
              "flex-1 p-6 overflow-auto leading-relaxed",
              devopsView === 'code' ? "bg-slate-900 font-mono text-xs text-emerald-400" : "bg-white"
            )}>
              {devopsView === 'code' ? (
                <pre className="whitespace-pre-wrap">
                  {typeof (devopsFiles[activeFile as keyof typeof devopsFiles]?.code || devopsFiles[activeFile as keyof typeof devopsFiles]) === 'string' 
                    ? (devopsFiles[activeFile as keyof typeof devopsFiles]?.code || devopsFiles[activeFile as keyof typeof devopsFiles])
                    : JSON.stringify(devopsFiles[activeFile as keyof typeof devopsFiles]?.code || devopsFiles[activeFile as keyof typeof devopsFiles], null, 2)}
                </pre>
              ) : (
                <ArchitectureVisualizer structure={customArch.structure} />
              )}
            </div>
          </div>

          {securityAudit && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="stat-card border-emerald-primary/20"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                  <Shield className="text-emerald-primary" size={20} />
                  Security Audit Report
                </h3>
                <button onClick={() => setSecurityAudit(null)} className="text-text-muted hover:text-red-500"><Trash2 size={18} /></button>
              </div>
              <div className="prose prose-sm prose-emerald max-w-none prose-p:leading-relaxed">
                <ReactMarkdown>{securityAudit}</ReactMarkdown>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );

  const renderHistory = () => (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold text-emerald-primary uppercase tracking-[0.2em] mb-2">Workspace / Archive</p>
          <h2 className="text-3xl font-bold text-text-primary tracking-tight">Activity History</h2>
          <p className="text-sm text-text-secondary mt-1">Review your past AI interactions and generated assets.</p>
        </div>
        <button onClick={() => setHistory([])} className="btn-secondary text-red-500 hover:bg-red-50 hover:border-red-100">
          <Trash2 size={16} />
          Clear All History
        </button>
      </div>

      <div className="stat-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-4 px-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Type</th>
                <th className="text-left py-4 px-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Input Preview</th>
                <th className="text-left py-4 px-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Date</th>
                <th className="text-right py-4 px-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {history.map((item) => (
                <tr key={item.id} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center",
                        item.type === 'resume' ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"
                      )}>
                        {item.type === 'resume' ? <FileText size={14} /> : <Map size={14} />}
                      </div>
                      <span className="text-xs font-bold text-text-primary capitalize">{item.type}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <p className="text-xs text-text-secondary line-clamp-1 max-w-md italic">"{item.input}"</p>
                  </td>
                  <td className="py-4 px-4 text-xs text-text-muted">
                    {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString() : 'Just now'}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <button className="p-2 text-text-muted hover:text-emerald-primary transition-colors">
                      <ChevronRight size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-20 text-center">
                    <History className="w-12 h-12 mx-auto mb-4 text-slate-200" />
                    <p className="text-sm text-slate-400 font-medium">No history found. Start exploring features!</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderAdmin = () => (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold text-red-500 uppercase tracking-[0.2em] mb-2">System / Control</p>
          <h2 className="text-3xl font-bold text-text-primary tracking-tight">Admin Terminal</h2>
          <p className="text-sm text-text-secondary mt-1">Configure system parameters and monitor AI agent health.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="stat-card border-red-500/10">
          <h4 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
            <Settings size={18} className="text-red-500" />
            Model Configuration
          </h4>
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 block">Primary Model</label>
              <select 
                value={adminSettings.primaryModel}
                onChange={(e) => setAdminSettings({ ...adminSettings, primaryModel: e.target.value })}
                className="input-field py-2 text-xs"
              >
                <option value="gemini-3-flash-preview">gemini-3-flash-preview</option>
                <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview</option>
                <option value="gemini-3.1-flash-lite-preview">gemini-3.1-flash-lite-preview</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 block flex justify-between">
                Temperature
                <span className="text-red-500">{adminSettings.temperature}</span>
              </label>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.1"
                value={adminSettings.temperature}
                onChange={(e) => setAdminSettings({ ...adminSettings, temperature: parseFloat(e.target.value) })}
                className="w-full accent-red-500" 
              />
            </div>
            <button className="btn-primary py-2 text-[10px] w-full bg-red-500 hover:bg-red-600 border-red-600 shadow-red-500/20">
              Apply System Changes
            </button>
          </div>
        </div>

        <div className="stat-card">
          <h4 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
            <Activity size={18} className="text-emerald-500" />
            System Health
          </h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
              <span className="text-xs font-medium text-text-secondary">API Latency</span>
              <span className="text-xs font-bold text-emerald-primary">{adminSettings.latency}ms</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
              <span className="text-xs font-medium text-text-secondary">Token Usage</span>
              <span className="text-xs font-bold text-blue-500">{adminSettings.tokenUsage.toLocaleString()} / 10k</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
              <span className="text-xs font-medium text-text-secondary">Active Agents</span>
              <span className="text-xs font-bold text-purple-500">3</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <h4 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
            <Shield size={18} className="text-blue-500" />
            Security
          </h4>
          <div className="space-y-2">
            <button className="btn-secondary w-full py-2 text-[10px]">Rotate API Keys</button>
            <button className="btn-secondary w-full py-2 text-[10px]">Audit Logs</button>
            <button className="btn-secondary w-full py-2 text-[10px] text-red-500 hover:bg-red-50">Emergency Shutdown</button>
          </div>
        </div>
      </div>
    </div>
  );

  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  const handleTestConnection = async () => {
    setTestStatus('testing');
    try {
      await generalCareerAdvice("Hello, are you operational?", apiSettings);
      setTestStatus('success');
      setTimeout(() => setTestStatus('idle'), 3000);
    } catch (error) {
      console.error(error);
      setTestStatus('error');
      setTimeout(() => setTestStatus('idle'), 5000);
    }
  };

  const renderSettings = () => (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <p className="text-[10px] font-bold text-emerald-primary uppercase tracking-[0.2em] mb-2">Configuration / API</p>
        <h2 className="text-3xl font-bold text-text-primary tracking-tight">AI Model Settings</h2>
        <p className="text-sm text-text-secondary mt-1">Configure your OpenRouter credentials to power the AI agents.</p>
      </div>

      <div className="stat-card space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-text-muted uppercase tracking-widest mb-2">OpenRouter API Key</label>
            <div className="relative">
              <input
                type="password"
                value={apiSettings.openRouterKey}
                onChange={(e) => {
                  const val = e.target.value;
                  setApiSettings(prev => ({ ...prev, openRouterKey: val }));
                  localStorage.setItem('openrouter_key', val);
                }}
                placeholder="sk-or-v1-..."
                className="w-full bg-slate-50 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-primary/20 transition-all font-mono"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted">
                <Shield size={16} />
              </div>
            </div>
            <p className="text-[10px] text-text-muted mt-2">Your key is stored locally in your browser and never shared.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-text-muted uppercase tracking-widest mb-2">Preferred Model</label>
            <select
              value={apiSettings.openRouterModel}
              onChange={(e) => {
                const val = e.target.value;
                setApiSettings(prev => ({ ...prev, openRouterModel: val }));
                localStorage.setItem('openrouter_model', val);
              }}
              className="w-full bg-slate-50 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-primary/20 transition-all"
            >
              <option value="stepfun/step-3.5-flash:free">Step-3.5 Flash (Free)</option>
              <option value="google/gemini-2.0-flash-exp:free">Gemini 2.0 Flash Exp (Free)</option>
              <option value="google/gemini-flash-1.5:free">Gemini 1.5 Flash (Free)</option>
              <option value="mistralai/mistral-7b-instruct:free">Mistral 7B Instruct (Free)</option>
              <option value="meta-llama/llama-3-8b-instruct:free">Llama 3 8B Instruct (Free)</option>
              <option value="openrouter/auto">Auto (OpenRouter Default)</option>
            </select>
          </div>

          <div className="pt-4 border-t border-border">
            <button 
              onClick={handleTestConnection}
              disabled={testStatus === 'testing' || !apiSettings.openRouterKey}
              className={cn(
                "btn-secondary w-full py-3",
                testStatus === 'success' && "bg-emerald-50 text-emerald-600 border-emerald-200",
                testStatus === 'error' && "bg-red-50 text-red-600 border-red-200"
              )}
            >
              {testStatus === 'testing' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Testing Connection...
                </>
              ) : testStatus === 'success' ? (
                <>
                  <CheckCircle2 size={16} />
                  Connection Successful
                </>
              ) : testStatus === 'error' ? (
                <>
                  <AlertCircle size={16} />
                  Connection Failed
                </>
              ) : (
                <>
                  <Activity size={16} />
                  Test API Connection
                </>
              )}
            </button>
          </div>
        </div>

        <div className="p-4 bg-emerald-dim rounded-xl border border-emerald-primary/10 flex gap-4">
          <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-emerald-primary shrink-0">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-emerald-primary">Settings Saved</h4>
            <p className="text-xs text-emerald-primary/70 leading-relaxed">Your API configuration is active. All career tools will now use these credentials.</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    if (!user && activeTab !== 'dashboard' && activeTab !== 'settings') {
      return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6">
          <div className="logo-icon mb-6 w-16 h-16 text-2xl">C</div>
          <h2 className="text-2xl font-bold mb-2">Authentication Required</h2>
          <p className="text-text-secondary mb-8 max-w-md font-medium">Please sign in to access the Architect Workspace and persist your career data.</p>
          <button onClick={handleLogin} className="btn-primary max-w-xs">
            <LogIn size={18} /> Sign In with Google
          </button>
          {loginError && (
            <div className="mt-4 p-3 bg-red-50 text-red-600 text-xs rounded-lg border border-red-100 flex items-center gap-2 max-w-xs">
              <AlertCircle size={14} />
              <span>{loginError}</span>
            </div>
          )}
        </div>
      );
    }

    switch (activeTab) {
      case 'dashboard': return renderDashboard();
      case 'chat': return renderAICoach();
      case 'resume': return renderResumeLab();
      case 'roadmap': return renderRoadmap();
      case 'devops': return renderDevOps();
      case 'history': return renderHistory();
      case 'admin': return renderAdmin();
      case 'settings': return renderSettings();
      default: return renderDashboard();
    }
  };













  const NavItem = ({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) => (
    <button
      onClick={onClick}
      className={cn(
        "nav-item w-full",
        active && "active"
      )}
    >
      {icon}
      <span>{label}</span>
      {active && (
        <motion.div 
          layoutId="active-pill"
          className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-primary"
        />
      )}
    </button>
  );

  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-bg-alt flex flex-col shrink-0">
        <div className="p-6 flex items-center gap-3">
          <div className="logo-icon">
            <Cpu size={20} />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-text-primary">CareerPath</h1>
            <p className="text-[10px] text-emerald-primary font-bold uppercase tracking-widest">Architect v11.2</p>
          </div>
        </div>

        <nav className="flex-1 px-4 py-2 overflow-y-auto">
          <div className="mb-6">
            <p className="px-4 mb-2 text-[10px] font-bold text-text-muted uppercase tracking-widest">Main</p>
            <NavItem active={activeTab === 'dashboard'} icon={<LayoutDashboard size={18} />} label="Dashboard" onClick={() => setActiveTab('dashboard')} />
            <NavItem active={activeTab === 'chat'} icon={<MessageSquare size={18} />} label="AI Coach" onClick={() => setActiveTab('chat')} />
          </div>

          <div className="mb-6">
            <p className="px-4 mb-2 text-[10px] font-bold text-text-muted uppercase tracking-widest">Tools</p>
            <NavItem active={activeTab === 'resume'} icon={<FileSearch size={18} />} label="Resume Lab" onClick={() => setActiveTab('resume')} />
            <NavItem active={activeTab === 'roadmap'} icon={<Map size={18} />} label="Career Path" onClick={() => setActiveTab('roadmap')} />
            <NavItem active={activeTab === 'devops'} icon={<Terminal size={18} />} label="DevOps Architect" onClick={() => setActiveTab('devops')} />
          </div>

          <div>
            <p className="px-4 mb-2 text-[10px] font-bold text-text-muted uppercase tracking-widest">System</p>
            <NavItem active={activeTab === 'history'} icon={<History size={18} />} label="Activity" onClick={() => setActiveTab('history')} />
            <NavItem active={activeTab === 'settings'} icon={<Settings size={18} />} label="Settings" onClick={() => setActiveTab('settings')} />
            {user?.role === 'admin' && <NavItem active={activeTab === 'admin'} icon={<Shield size={18} />} label="Admin" onClick={() => setActiveTab('admin')} />}
          </div>
        </nav>

        <div className="p-4 border-t border-border">
          {user ? (
            <div className="flex items-center gap-3 px-2 py-2">
              <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full border border-border" referrerPolicy="no-referrer" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-text-primary truncate">{user.displayName}</p>
                <p className="text-[10px] text-text-muted truncate">{user.email}</p>
              </div>
              <button onClick={handleLogout} className="text-text-muted hover:text-red-500 transition-colors">
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <button onClick={handleLogin} className="btn-primary w-full">
                <LogIn size={16} />
                <span>Sign In</span>
              </button>
              {loginError && (
                <div className="p-2 bg-red-50 text-red-600 text-[10px] rounded border border-red-100 flex items-center gap-1">
                  <AlertCircle size={10} />
                  <span className="truncate">{loginError}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 border-b border-border bg-white flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-text-primary capitalize">{activeTab.replace('-', ' ')}</h2>
            <div className="w-1 h-1 rounded-full bg-border mx-2" />
            <div className="flex items-center gap-1.5">
              <div className="pulse" />
              <span className="text-[10px] font-bold text-emerald-primary uppercase tracking-widest">System Online</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input 
                type="text" 
                placeholder="Search tools..." 
                className="bg-slate-50 border border-border rounded-full pl-9 pr-4 py-1.5 text-xs outline-none focus:border-emerald-primary w-48 transition-all"
              />
            </div>
            <button 
              onClick={() => setActiveTab('settings')}
              className="p-2 text-text-muted hover:text-text-primary transition-colors"
            >
              <Settings size={18} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 bg-bg">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="max-w-6xl mx-auto"
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {loading && (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-[2px] z-50 flex items-center justify-center">
          <div className="bg-white border border-border p-6 rounded-2xl shadow-2xl flex flex-col items-center gap-4">
            <Loader2 className="animate-spin text-emerald-primary" size={32} />
            <p className="text-xs font-bold text-text-primary uppercase tracking-widest animate-pulse">Processing Request...</p>
          </div>
        </div>
      )}
    </div>
  );
}

function NavItem({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn("nav-item w-full", active && "active")}
    >
      <span className="shrink-0">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function DashboardCard({ title, desc, icon, onClick }: { title: string; desc: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <motion.div 
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="stat-card cursor-pointer group"
    >
      <div className="w-12 h-12 bg-bg border border-border rounded-xl flex items-center justify-center mb-4 group-hover:border-border-alt transition-colors">
        {icon}
      </div>
      <h3 className="text-lg font-extrabold mb-2 tracking-tight">{title}</h3>
      <p className="text-xs text-text-secondary leading-relaxed">{desc}</p>
      <div className="mt-4 flex items-center gap-1 text-[10px] font-bold text-emerald-primary uppercase tracking-widest font-mono opacity-0 group-hover:opacity-100 transition-opacity">
        Initialize <ChevronRight size={10} />
      </div>
    </motion.div>
  );
}

function Upload({ className, size }: { className?: string, size?: number }) {
  return (
    <svg 
      className={className} 
      width={size || 24} 
      height={size || 24} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}
