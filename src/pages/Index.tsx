
import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import TypingArea from '../components/TypingArea';
import QuoteUploader from '../components/QuoteUploader';
import TemplateMenu from '../components/TemplateMenu';
import { defaultQuotes } from '../utils/typingUtils';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/use-toast';

const Index = () => {
  const [quotes, setQuotes] = useState<string[]>(defaultQuotes);
  const [activeScriptId, setActiveScriptId] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Fetch or create default script on load
  useEffect(() => {
    const setupDefaultScript = async () => {
      if (!user) return;
      
      try {
        // Try to find existing default script
        const { data: scripts, error } = await supabase
          .from('scripts')
          .select('id')
          .eq('user_id', user.id)
          .eq('title', 'Default')
          .maybeSingle();
        
        if (error) {
          console.error('Error fetching default script:', error);
          return;
        }
        
        if (scripts) {
          // Use existing default script
          setActiveScriptId(scripts.id);
        } else {
          // Create a new default script
          const { data: newScript, error: createError } = await supabase
            .from('scripts')
            .insert({
              user_id: user.id,
              title: 'Default',
              content: JSON.stringify(defaultQuotes),
              category: 'Default',
              created_by: user.id
            })
            .select()
            .single();
          
          if (createError) {
            console.error('Error creating default script:', createError);
            return;
          }
          
          setActiveScriptId(newScript.id);
        }
      } catch (error) {
        console.error('Unexpected error during script setup:', error);
      }
    };
    
    if (user) {
      setupDefaultScript();
    }
  }, [user]);
  
  const handleQuotesLoaded = (newQuotes: string[]) => {
    setQuotes(newQuotes);
  };
  
  const handleTemplateSelected = (templateQuotes: string[], scriptId?: string) => {
    setQuotes(templateQuotes);
    if (scriptId) {
      setActiveScriptId(scriptId);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-900">
      <Header />
      
      <main className="flex-1 container max-w-6xl mx-auto px-4 py-10">
        <div className="mb-8 text-center">
          <h2 className="text-lg text-monkey-subtle mb-2">type your favorite things</h2>
        </div>
        
        <TemplateMenu onSelectTemplate={handleTemplateSelected} />
        
        <TypingArea quotes={quotes} scriptId={activeScriptId} />
        
        <QuoteUploader onQuotesLoaded={handleQuotesLoaded} />
      </main>
      
      <Footer />
    </div>
  );
};

export default Index;
