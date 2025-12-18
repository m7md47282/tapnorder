import { Component } from '@angular/core';
import { CoreService } from 'src/app/services/core.service';

@Component({
  selector: 'app-branding',
  imports: [],
  template: `
    <div class="d-flex align-items-center gap-2">
      <img
        src="./assets/images/logo.png"
        class="align-middle m-2"
        alt="logo"
        width="40"
      />
      <span class="text-primary">Tap n Order</span>
</div>
   
  `,
})
export class BrandingComponent {
  options = this.settings.getOptions();
  constructor(private settings: CoreService) {}
}
