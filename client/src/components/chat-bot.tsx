import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
}

interface FAQItem {
  keywords: string[];
  answer: string;
  category: string;
}

const faqDatabase: FAQItem[] = [
  {
    keywords: ["staking", "stake", "apy", "interest", "earn", "passive"],
    answer: "XNRT offers 4 staking tiers with APY ranging from 30% to 730%! You can stake your XNRT tokens for different durations (30, 90, 180, or 365 days) and earn daily rewards automatically. Visit the Staking page to get started!",
    category: "staking"
  },
  {
    keywords: ["mining", "mine", "xp", "session", "24 hours"],
    answer: "Mining sessions run for 24 hours and reward you with 10 XP + 5 XNRT per session! Sessions complete automatically and there's no cooldown - you can start a new session immediately after one ends.",
    category: "mining"
  },
  {
    keywords: ["referral", "refer", "commission", "invite", "share", "link"],
    answer: "Our 3-level referral system rewards you with: 6% from Level 1, 3% from Level 2, and 1% from Level 3! Share your referral link to build your network and earn passive commissions from your downline's earnings.",
    category: "referrals"
  },
  {
    keywords: ["deposit", "add funds", "usdt", "balance", "top up"],
    answer: "To deposit, go to the Wallet page and click 'Deposit USDT'. Upload your proof of payment and wait for admin approval. USDT is converted to XNRT at a 1:1 ratio.",
    category: "deposits"
  },
  {
    keywords: ["withdraw", "withdrawal", "cash out", "send", "transfer"],
    answer: "Withdrawals have a 2% fee and require admin approval. Go to Wallet > Withdraw, enter the amount and your wallet address. Your XNRT will be converted to USDT and sent once approved.",
    category: "withdrawals"
  },
  {
    keywords: ["task", "daily", "check-in", "checkin", "streak", "reward"],
    answer: "Complete daily check-ins to earn streak rewards! The longer your streak, the bigger the rewards. You'll also unlock achievements as you progress!",
    category: "tasks"
  },
  {
    keywords: ["account", "register", "sign up", "login", "password", "forgot"],
    answer: "You can register with email/password or use your Replit account. If you forgot your password, click 'Forgot Password?' on the login page to reset it via email.",
    category: "account"
  },
  {
    keywords: ["balance", "wallet", "tokens", "xnrt amount", "how much"],
    answer: "Check your XNRT balance anytime in the Wallet section. Your balance includes tokens from staking, mining, referrals, and daily rewards!",
    category: "wallet"
  },
  {
    keywords: ["help", "support", "contact", "email", "assistance"],
    answer: "Need personalized help? Email our support team at support@xnrt.org - we're here 24/7 to assist you!",
    category: "support"
  },
  {
    keywords: ["hello", "hi", "hey", "greetings", "start"],
    answer: "Hello! 👋 I'm your XNRT support assistant. I can help you with questions about staking, mining, referrals, deposits, withdrawals, and more. What would you like to know?",
    category: "greeting"
  }
];

function findBestMatch(userMessage: string): FAQItem | null {
  const lowerMessage = userMessage.toLowerCase();
  const words = lowerMessage.split(/\s+/);
  
  let bestMatch: FAQItem | null = null;
  let highestScore = 0;
  
  for (const faq of faqDatabase) {
    let score = 0;
    
    // Check for keyword matches
    for (const keyword of faq.keywords) {
      if (lowerMessage.includes(keyword)) {
        score += 2;
      }
      // Check individual words
      for (const word of words) {
        if (keyword.includes(word) && word.length > 2) {
          score += 1;
        }
      }
    }
    
    if (score > highestScore) {
      highestScore = score;
      bestMatch = faq;
    }
  }
  
  // Only return match if score is significant
  return highestScore >= 2 ? bestMatch : null;
}

export function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      text: "Hi! I'm your XNRT support assistant. Ask me about staking, mining, referrals, or anything else!",
      sender: "bot",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);
  
  const handleSend = (messageOverride?: string) => {
    const messageText = messageOverride || input;
    if (!messageText.trim()) return;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      text: messageText,
      sender: "user",
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    
    // Find best matching FAQ
    setTimeout(() => {
      const match = findBestMatch(messageText);
      const botResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: match 
          ? match.answer 
          : "I'm not sure about that. Please email our support team at support@xnrt.org for personalized assistance!",
        sender: "bot",
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, botResponse]);
    }, 500);
  };
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  return (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 p-0 shadow-lg hover:shadow-amber-500/50 transition-all duration-300 hover:scale-110"
          data-testid="button-open-chat"
          aria-label="Open support chat"
        >
          <MessageCircle className="h-6 w-6 text-white" />
        </Button>
      )}
      
      {/* Chat Window */}
      {isOpen && (
        <div 
          className="fixed bottom-6 right-6 z-50 flex flex-col w-[380px] h-[500px] rounded-2xl border border-amber-500/30 bg-black/90 backdrop-blur-xl shadow-2xl shadow-amber-500/20"
          data-testid="container-chat-window"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-amber-500/20 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 px-4 py-3 rounded-t-2xl">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-green-400 animate-pulse" />
              <h3 className="text-sm font-semibold text-white">XNRT Support</h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="h-8 w-8 p-0 hover:bg-white/10"
              data-testid="button-close-chat"
              aria-label="Close chat"
            >
              <X className="h-4 w-4 text-white/70" />
            </Button>
          </div>
          
          {/* Messages */}
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex",
                    msg.sender === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                      msg.sender === "user"
                        ? "bg-gradient-to-r from-amber-500 to-yellow-500 text-white"
                        : "bg-white/10 text-white/90 border border-amber-500/20"
                    )}
                    data-testid={`message-${msg.sender}`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          
          {/* Quick Actions */}
          <div className="border-t border-amber-500/20 px-4 py-2">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {["Staking", "Mining", "Referrals", "Withdrawal"].map((topic) => (
                <Button
                  key={topic}
                  variant="outline"
                  size="sm"
                  onClick={() => handleSend(topic)}
                  className="shrink-0 border-amber-500/30 bg-white/5 text-xs text-white/70 hover:bg-amber-500/20 hover:text-white"
                  data-testid={`button-quick-${topic.toLowerCase()}`}
                >
                  {topic}
                </Button>
              ))}
            </div>
          </div>
          
          {/* Input */}
          <div className="border-t border-amber-500/20 bg-black/40 p-4 rounded-b-2xl">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything..."
                className="flex-1 border-amber-500/30 bg-white/5 text-white placeholder:text-white/40 focus-visible:border-amber-500 focus-visible:ring-amber-500/20"
                data-testid="input-chat-message"
              />
              <Button
                onClick={() => handleSend()}
                disabled={!input.trim()}
                className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 disabled:opacity-50"
                size="icon"
                data-testid="button-send-message"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-white/40">
              <Mail className="h-3 w-3" />
              <span>Need more help?</span>
              <a 
                href="mailto:support@xnrt.org" 
                className="text-amber-400 hover:underline"
                data-testid="link-chat-email"
              >
                support@xnrt.org
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
