import TodayTasks from "@/components/dashboard/TodayTasks";
import SyllabusProgress from "@/components/dashboard/SyllabusProgress";
import SubjectCards from "@/components/dashboard/SubjectCards";
import StudyCalendar from "@/components/dashboard/StudyCalendar";

const Index = () => {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  return (
    <div className="space-y-6">
      <div className="animate-fade-in">
        <h1 className="font-heading text-3xl font-bold text-foreground">{greeting} 👋</h1>
        <p className="text-muted-foreground mt-1">Let's make today productive.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <TodayTasks />
          <SyllabusProgress />
          <SubjectCards />
        </div>
        <div className="lg:col-span-1">
          <StudyCalendar />
        </div>
      </div>
    </div>
  );
};

export default Index;
