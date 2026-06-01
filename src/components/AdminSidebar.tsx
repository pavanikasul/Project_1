import Link from 'next/link';
import { LayoutGrid } from 'lucide-react';

export default function AdminSidebar() {
  return (
    <nav className="sidebar">
      <ul className="menu">
        {/* Existing admin links can stay here */}
        <li>
          <Link href="/admin/exam-sets">
            <LayoutGrid size={20} /> Exam Sets
          </Link>
        </li>
        {/* Add other links as needed */}
      </ul>
      <style jsx>{`
        .sidebar { padding: 1rem; background: var(--clr-surface); height: 100vh; }
        .menu { list-style:none; margin:0; padding:0; }
        .menu li { margin: .5rem 0; }
        .menu a { color:#e0e0e0; text-decoration:none; display:flex; align-items:center; gap:.5rem; }
        .menu a:hover { color:#fff; }
      `}</style>
    </nav>
  );
}
