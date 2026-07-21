import { FileText, BookOpen, Layers, Headphones } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MaterialsTab } from '@/components/content/MaterialsTab';
import { CourseContentTab } from '@/components/content/CourseContentTab';
import { FlashcardsTab } from '@/components/content/FlashcardsTab';
import { TextsTab } from '@/components/content/TextsTab';
import type { ClassOption } from '@/components/content/VisibilitySelector';

interface ClassContentManagerProps {
  classId: string;
  className?: string;
  isAdmin?: boolean;
  allClasses?: ClassOption[];
}

export function ClassContentManager({ classId, className, isAdmin = false, allClasses = [] }: ClassContentManagerProps) {
  return (
    <Tabs defaultValue="materials" className="space-y-6">
      <TabsList>
        <TabsTrigger value="materials" className="gap-2"><FileText className="h-4 w-4" /> Materiais</TabsTrigger>
        <TabsTrigger value="course" className="gap-2"><BookOpen className="h-4 w-4" /> Curso</TabsTrigger>
        <TabsTrigger value="flashcards" className="gap-2"><Layers className="h-4 w-4" /> Flashcards</TabsTrigger>
        <TabsTrigger value="texts" className="gap-2"><Headphones className="h-4 w-4" /> Textos com Áudio</TabsTrigger>
      </TabsList>
      <TabsContent value="materials">
        <MaterialsTab classId={classId} className={className} isAdmin={isAdmin} allClasses={allClasses} />
      </TabsContent>
      <TabsContent value="course">
        <CourseContentTab classId={classId} className={className} isAdmin={isAdmin} allClasses={allClasses} />
      </TabsContent>
      <TabsContent value="flashcards">
        <FlashcardsTab classId={classId} className={className} isAdmin={isAdmin} allClasses={allClasses} />
      </TabsContent>
      <TabsContent value="texts">
        <TextsTab classId={classId} className={className} isAdmin={isAdmin} allClasses={allClasses} />
      </TabsContent>
    </Tabs>
  );
}
