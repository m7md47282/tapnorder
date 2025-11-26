import { Routes } from '@angular/router';
import { StarterComponent } from './starter/starter.component';
import { AiAdvisorPageComponent } from './dashboard/ai-advisor-page/ai-advisor-page.component';

export const PagesRoutes: Routes = [
  {
    path: '',
    component: StarterComponent,
    data: {
      title: 'Starter Page',
      urls: [
        { title: 'Dashboard', url: '/dashboards/dashboard1' },
        { title: 'Starter Page' },
      ],
    },
  },
  {
    path: 'ai-advisor',
    component: AiAdvisorPageComponent,
    data: {
      title: 'AI Business Advisor',
      urls: [
        { title: 'Dashboard', url: '/dashboard' },
        { title: 'AI Business Advisor' },
      ],
    },
  },
];
