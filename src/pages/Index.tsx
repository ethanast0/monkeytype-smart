
import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import TypingArea from '../components/TypingArea';
import TemplateMenu from '../components/TemplateMenu';
import { defaultQuotes } from '../utils/typingUtils';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/use-toast';

const Index = () => {
  const [quotes, setQuotes] = useState<string[]>(defaultQuotes);
  const [activeScriptId, setActiveScriptId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const setupDefaultScript = async () => {
      if (!user) return;
      try {
        const { data: scripts, error } = await supabase
          .from('scripts')
          .select('id')
          .eq('user_id', user.id)
          .eq('name', 'Default')
          .maybeSingle();
          
        if (error) {
          console.error('Error fetching default script:', error);
          return;
        }
        
        let scriptId: string;
        
        if (scripts) {
          scriptId = scripts.id;
        } else {
          const { data: newScript, error: createError } = await supabase
            .from('scripts')
            .insert({
              user_id: user.id,
              name: 'Default',
              content: JSON.stringify(defaultQuotes),
              category: 'Default',
            })
            .select()
            .single();
            
          if (createError) {
            console.error('Error creating default script:', createError);
            return;
          }
          
          scriptId = newScript.id;
          
          // Also insert quotes into script_quotes table
          const quoteInserts = defaultQuotes.map((quote, index) => ({
            script_id: scriptId,
            content: quote,
            quote_index: index
          }));
          
          const { error: quotesError } = await supabase
            .from('script_quotes')
            .insert(quoteInserts);
            
          if (quotesError) {
            console.error('Error saving default quotes:', quotesError);
          }
        }
        
        setActiveScriptId(scriptId);
        
        // Fetch quotes from script_quotes table
        const { data: quoteData, error: quotesError } = await supabase
          .from('script_quotes')
          .select('content')
          .eq('script_id', scriptId)
          .order('quote_index', { ascending: true });
          
        if (quotesError) {
          console.error('Error fetching quotes:', quotesError);
          return;
        }
        
        if (quoteData && quoteData.length > 0) {
          setQuotes(quoteData.map(q => q.content));
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

  const handleTemplateSelected = async (templateQuotes: string[], scriptId?: string) => {
    setQuotes(templateQuotes);
    if (scriptId) {
      setActiveScriptId(scriptId);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1 container max-w-6xl mx-auto px-4 py-10 flex flex-col justify-center">
        <TemplateMenu onSelectTemplate={handleTemplateSelected} isTyping={isTyping} />
        
        <TypingArea 
          quotes={quotes} 
          scriptId={activeScriptId} 
          onQuotesLoaded={handleQuotesLoaded}
          onTypingStateChange={setIsTyping}
        />
      </main>
      
      <Footer />
    </div>
  );
};

export default Index;
