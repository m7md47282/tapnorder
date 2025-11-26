import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MaterialModule } from '../../../material.module';
import { AdminAiAdvisorComponent } from '../components/admin-ai-advisor/admin-ai-advisor.component';

@Component({
  selector: 'app-ai-advisor-page',
  standalone: true,
  imports: [CommonModule, MaterialModule, FormsModule, AdminAiAdvisorComponent],
  templateUrl: './ai-advisor-page.component.html',
  styleUrls: ['./ai-advisor-page.component.scss']
})
export class AiAdvisorPageComponent implements OnInit {
  initialTab: number = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Check for tab query parameter
    this.route.queryParams.subscribe(params => {
      const tab = params['tab'];
      if (tab === 'insights') {
        this.initialTab = 0;
      } else if (tab === 'offers') {
        this.initialTab = 1;
      } else if (tab === 'chat') {
        this.initialTab = 2;
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }
}

