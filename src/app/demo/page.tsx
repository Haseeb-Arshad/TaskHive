'use client';

import { ComingSoonBadge } from '@/components';

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-2">Component Demo</h1>
        <p className="text-slate-400 mb-12">
          Showcasing the ComingSoon badge component in different sizes
        </p>

        {/* Component Grid */}
        <div className="space-y-12">
          {/* Small Size */}
          <div className="bg-slate-800 rounded-lg p-8 border border-slate-700">
            <h2 className="text-xl font-semibold text-white mb-6">Small Badge</h2>
            <div className="flex items-center gap-4">
              <ComingSoonBadge size="sm" text="Coming Soon" />
              <p className="text-slate-400 text-sm">
                Size: sm | Perfect for compact spaces
              </p>
            </div>
          </div>

          {/* Medium Size (Default) */}
          <div className="bg-slate-800 rounded-lg p-8 border border-slate-700">
            <h2 className="text-xl font-semibold text-white mb-6">Medium Badge (Default)</h2>
            <div className="flex items-center gap-4">
              <ComingSoonBadge size="md" text="Coming Soon" />
              <p className="text-slate-400 text-sm">
                Size: md | Standard size for most use cases
              </p>
            </div>
          </div>

          {/* Large Size */}
          <div className="bg-slate-800 rounded-lg p-8 border border-slate-700">
            <h2 className="text-xl font-semibold text-white mb-6">Large Badge</h2>
            <div className="flex items-center gap-4">
              <ComingSoonBadge size="lg" text="Coming Soon" />
              <p className="text-slate-400 text-sm">
                Size: lg | Prominent display on main sections
              </p>
            </div>
          </div>

          {/* Custom Text */}
          <div className="bg-slate-800 rounded-lg p-8 border border-slate-700">
            <h2 className="text-xl font-semibold text-white mb-6">Custom Text</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <ComingSoonBadge size="md" text="In Development" />
                <p className="text-slate-400 text-sm">Custom text variant</p>
              </div>
              <div className="flex items-center gap-4">
                <ComingSoonBadge size="md" text="Beta Feature" />
                <p className="text-slate-400 text-sm">Another variant</p>
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="bg-slate-800 rounded-lg p-8 border border-slate-700">
            <h2 className="text-xl font-semibold text-white mb-6">Features</h2>
            <ul className="space-y-2 text-slate-400">
              <li className="flex items-center gap-2">
                <span className="text-blue-400">✓</span> Gradient purple-to-blue background
              </li>
              <li className="flex items-center gap-2">
                <span className="text-blue-400">✓</span> Smooth hover scale animation (1.05x)
              </li>
              <li className="flex items-center gap-2">
                <span className="text-blue-400">✓</span> Pulse animation for visual interest
              </li>
              <li className="flex items-center gap-2">
                <span className="text-blue-400">✓</span> Three sizes: sm, md, lg
              </li>
              <li className="flex items-center gap-2">
                <span className="text-blue-400">✓</span> Customizable text prop
              </li>
              <li className="flex items-center gap-2">
                <span className="text-blue-400">✓</span> Fully responsive design
              </li>
              <li className="flex items-center gap-2">
                <span className="text-blue-400">✓</span> Tailwind CSS only (no external CSS)
              </li>
            </ul>
          </div>

          {/* Usage Code */}
          <div className="bg-slate-800 rounded-lg p-8 border border-slate-700">
            <h2 className="text-xl font-semibold text-white mb-6">Usage</h2>
            <pre className="bg-slate-900 p-4 rounded text-slate-300 text-sm overflow-x-auto">
{`import { ComingSoonBadge } from '@/components';

// Default usage
<ComingSoonBadge />

// Custom size
<ComingSoonBadge size="lg" />

// Custom text
<ComingSoonBadge text="In Development" />

// Custom size and text
<ComingSoonBadge size="sm" text="Beta" />`}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-slate-700">
          <p className="text-slate-500 text-sm">
            ComingSoon Badge Component - Reusable, responsive, and production-ready
          </p>
        </div>
      </div>
    </div>
  );
}
