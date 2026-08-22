import { memo } from "react";
import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { publicTaxonomyPath } from "../../../../routes/publicTaxonomyRoute";

interface SubjectBrowseProps {
  subjects: Array<{ documentId: string; name: string }>;
  username: string;
}

const SubjectBrowse = memo(({ subjects, username }: SubjectBrowseProps) => {
  if (subjects.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1.5 h-[22px] bg-amber-400 rounded-sm flex-shrink-0" />
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <BookOpen size={18} className="text-amber-400" /> Browse by Subject
        </h2>
      </div>
      <div className="flex flex-wrap gap-2">
        {subjects.slice(0, 30).map((subject) => (
          <Link
            key={subject.documentId}
            to={publicTaxonomyPath(username, "books", "subject", subject.documentId)}
            className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/8 text-white/70 hover:bg-amber-400/20 hover:text-amber-300 border border-white/10 hover:border-amber-400/30 transition-all"
          >
            {subject.name}
          </Link>
        ))}
      </div>
    </section>
  );
});

SubjectBrowse.displayName = "SubjectBrowse";
export default SubjectBrowse;
