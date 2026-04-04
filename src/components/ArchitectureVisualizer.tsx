import React from 'react';
import { motion } from 'motion/react';
import { 
  Cloud, 
  Server, 
  Database, 
  Shield, 
  Network, 
  Cpu, 
  Globe, 
  Lock, 
  Activity,
  ChevronRight,
  Box
} from 'lucide-react';
import { cn } from '../lib/utils';

interface Component {
  label: string;
  description: string;
  type: string;
  subcomponents?: Component[];
}

interface ArchitectureStructure {
  label: string;
  description: string;
  components: Component[];
}

interface ArchitectureVisualizerProps {
  structure: any;
}

const getIcon = (type: string, label?: string) => {
  const t = (type || label || '').toLowerCase();
  if (t.includes('vpc') || t.includes('network') || t.includes('subnet')) return <Network size={16} />;
  if (t.includes('db') || t.includes('database') || t.includes('rds') || t.includes('mysql')) return <Database size={16} />;
  if (t.includes('security') || t.includes('iam') || t.includes('shield') || t.includes('policy') || t.includes('role')) return <Shield size={16} />;
  if (t.includes('compute') || t.includes('ec2') || t.includes('lambda') || t.includes('function') || t.includes('instance')) return <Cpu size={16} />;
  if (t.includes('storage') || t.includes('s3') || t.includes('bucket')) return <Box size={16} />;
  if (t.includes('gateway') || t.includes('elb') || t.includes('load balancer') || t.includes('api_gateway')) return <Globe size={16} />;
  if (t.includes('monitor') || t.includes('cloudwatch') || t.includes('alarm')) return <Activity size={16} />;
  return <Server size={16} />;
};

const ComponentNode: React.FC<{ component: any; label?: string; depth: number }> = ({ component, label, depth }) => {
  const [isExpanded, setIsExpanded] = React.useState(true);
  
  // Handle both structured components and raw objects
  const compLabel = component.label || label || 'Component';
  const compDesc = component.description || (typeof component === 'object' ? '' : String(component));
  const compType = component.type || compLabel;
  
  const subItems = component.subcomponents || component.components || (
    typeof component === 'object' && !Array.isArray(component) 
      ? Object.entries(component).filter(([k]) => !['label', 'description', 'type'].includes(k))
      : []
  );

  const hasSub = subItems.length > 0;

  return (
    <div className={cn("flex flex-col", depth > 0 && "ml-6 border-l border-emerald-primary/10 pl-4 mt-2")}>
      <motion.div 
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="group relative"
      >
        <div className={cn(
          "flex items-center gap-3 p-3 rounded-xl border transition-all",
          depth === 0 ? "bg-emerald-dim border-emerald-primary/20" : "bg-white border-border hover:border-emerald-primary/30"
        )}>
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center",
            depth === 0 ? "bg-emerald-primary text-white" : "bg-emerald-50 text-emerald-primary"
          )}>
            {getIcon(compType, compLabel)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h5 className="text-xs font-bold text-text-primary truncate">{compLabel}</h5>
              {hasSub && (
                <button 
                  onClick={() => setIsExpanded(!isExpanded)}
                  className={cn("p-1 text-text-muted hover:text-emerald-primary transition-transform", isExpanded && "rotate-90")}
                >
                  <ChevronRight size={14} />
                </button>
              )}
            </div>
            {compDesc && <p className="text-[10px] text-text-muted line-clamp-1">{compDesc}</p>}
          </div>
        </div>
      </motion.div>

      {hasSub && isExpanded && (
        <div className="flex flex-col gap-2">
          {Array.isArray(subItems) ? subItems.map((item, idx) => {
            if (Array.isArray(item)) {
              const [key, value] = item;
              return <ComponentNode key={`${key}-${idx}`} component={value} label={key} depth={depth + 1} />;
            }
            return <ComponentNode key={`${item.label}-${idx}`} component={item} depth={depth + 1} />;
          }) : null}
        </div>
      )}
    </div>
  );
};

export const ArchitectureVisualizer: React.FC<ArchitectureVisualizerProps> = ({ structure }) => {
  if (!structure) return null;

  const components = structure.components || (
    Array.isArray(structure) ? structure : Object.entries(structure).filter(([k]) => !['label', 'description'].includes(k))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-emerald-primary text-white flex items-center justify-center shadow-lg shadow-emerald-primary/20">
          <Cloud size={20} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-text-primary">{structure.label || 'Architecture Blueprint'}</h3>
          <p className="text-xs text-text-muted">{structure.description || 'Visual representation of cloud infrastructure'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Array.isArray(components) ? components.map((comp, idx) => {
          if (Array.isArray(comp)) {
            const [key, value] = comp;
            return <ComponentNode key={`${key}-${idx}`} component={value} label={key} depth={0} />;
          }
          return <ComponentNode key={`${comp.label}-${idx}`} component={comp} depth={0} />;
        }) : null}
      </div>
    </div>
  );
};
