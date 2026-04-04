import { useState } from "react";
import { Brain, Send, Sparkles, BookOpen, Lightbulb, HelpCircle } from "lucide-react";

type Level = "basic" | "moderate" | "hard" | "quiz";

const levels: { key: Level; label: string; icon: React.ElementType; desc: string }[] = [
  { key: "basic", label: "Basic", icon: BookOpen, desc: "Explains from the very fundamentals, even basics from earlier classes" },
  { key: "moderate", label: "Moderate", icon: Sparkles, desc: "Standard explanations with definitions and examples" },
  { key: "hard", label: "Challenge", icon: Lightbulb, desc: "Gives small clues so you figure it out yourself" },
  { key: "quiz", label: "Quiz Me", icon: HelpCircle, desc: "Tests you on a chapter with progressive hints" },
];

const AITutor = () => {
  const [activeLevel, setActiveLevel] = useState<Level>("moderate");
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([
    { role: "ai", text: "Hello! I'm your AI Tutor. Choose a difficulty level and ask me anything! 🎓" },
  ]);
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages((prev) => [
      ...prev,
      { role: "user", text: input },
      { role: "ai", text: `[${activeLevel.toUpperCase()} mode] This is a placeholder response. Connect to Lovable Cloud to enable real AI responses!` },
    ]);
    setInput("");
  };

  return (
    <div className="space-y-6">
      <div className="animate-fade-in">
        <h1 className="font-heading text-3xl font-bold text-foreground flex items-center gap-3">
          <Brain className="w-8 h-8 text-primary" /> AI Tutor
        </h1>
        <p className="text-muted-foreground mt-1">Your personal study companion</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-in">
        {levels.map(({ key, label, icon: Icon, desc }) => (
          <button
            key={key}
            onClick={() => setActiveLevel(key)}
            className={`glass-card p-4 text-left transition-all ${
              activeLevel === key ? "border-primary glow-primary" : "hover:border-muted-foreground/30"
            }`}
          >
            <Icon className={`w-5 h-5 mb-2 ${activeLevel === key ? "text-primary" : "text-muted-foreground"}`} />
            <h4 className="font-heading text-sm font-semibold text-foreground">{label}</h4>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{desc}</p>
          </button>
        ))}
      </div>

      <div className="glass-card flex flex-col h-[450px] animate-fade-in">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-secondary text-secondary-foreground rounded-bl-md"
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-border p-3 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask anything..."
            className="flex-1 bg-secondary rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button onClick={handleSend} className="bg-primary text-primary-foreground p-2.5 rounded-lg hover:opacity-90 transition-opacity">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AITutor;
