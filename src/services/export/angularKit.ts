/**
 * Portable AAVA Play kit for Angular exports.
 * Same selectors/inputs as the internal @aava/play package, so generated screens compile unchanged:
 * the export maps `@aava/play` → `src/app/aava-play/index.ts` via tsconfig `paths`.
 * Styling comes from the global, token-only aava-play.css.
 */
export const ANGULAR_AAVA_KIT = `// AAVA Play — portable Angular kit (generated). Drop-in for the internal @aava/play package.
import { Component, booleanAttribute, computed, forwardRef, input, numberAttribute, output, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

let nextId = 0;
const uid = () => \`aava-f-\${++nextId}\`;

/** Shared ControlValueAccessor so kit inputs work with formControlName. */
abstract class AavaValueAccessor<T> implements ControlValueAccessor {
  readonly value = signal<T | null>(null);
  readonly disabled = signal(false);
  protected onChange: (v: T) => void = () => undefined;
  protected onTouched: () => void = () => undefined;
  writeValue(v: T | null): void {
    this.value.set(v);
  }
  registerOnChange(fn: (v: T) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }
  protected update(v: T): void {
    this.value.set(v);
    this.onChange(v);
  }
  touched(): void {
    this.onTouched();
  }
}

// ---- Layout & typography -------------------------------------------------------
@Component({
  selector: 'aava-card',
  host: { style: 'display: contents' },
  template: \`
    <section class="aava-card">
      @if (heading() || subheading()) {
        <header class="aava-card__head">
          @if (heading()) {
            <h3 class="aava-card__title">{{ heading() }}</h3>
          }
          @if (subheading()) {
            <p class="aava-card__sub">{{ subheading() }}</p>
          }
        </header>
      }
      <div class="aava-card__body"><ng-content /></div>
    </section>
  \`,
})
export class AavaCard {
  readonly heading = input<string>();
  readonly subheading = input<string>();
}

/** Renders as an ARIA heading (role + level) so tests can use getByRole('heading'). */
@Component({
  selector: 'aava-heading',
  host: { role: 'heading', '[attr.aria-level]': 'level()', '[class]': "'aava-heading aava-h' + level()", style: 'display: block' },
  template: '<ng-content />',
})
export class AavaHeading {
  readonly level = input(1, { transform: numberAttribute });
}

@Component({
  selector: 'aava-text',
  host: { '[class]': 'classes()', style: 'display: block' },
  template: '<ng-content />',
})
export class AavaText {
  readonly tone = input<string>('default');
  readonly size = input<string>('md');
  readonly weight = input<string>('normal');
  readonly align = input<string>('start');
  protected readonly classes = computed(() =>
    ['aava-text', \`aava-text--\${this.tone()}\`, this.size() === 'sm' ? 'aava-text--sm' : '', this.weight() === 'strong' ? 'aava-text--strong' : '', this.align() === 'center' ? 'aava-text--center' : ''].join(' '),
  );
}

@Component({
  selector: 'aava-badge',
  host: { '[class]': "'aava-badge aava-badge--' + tone()" },
  template: '<ng-content />',
})
export class AavaBadge {
  readonly tone = input<string>('neutral');
}

@Component({
  selector: 'aava-divider',
  host: { style: 'display: block' },
  template: \`<div class="aava-divider" role="separator">
    @if (label()) {
      <span>{{ label() }}</span>
    }
  </div>\`,
})
export class AavaDivider {
  readonly label = input<string>();
}

@Component({
  selector: 'aava-avatar',
  template: '<span class="aava-avatar" role="img" [attr.aria-label]="name()">{{ initials() }}</span>',
})
export class AavaAvatar {
  readonly name = input<string>('');
  readonly size = input<string>('md');
  protected readonly initials = computed(() =>
    this.name()
      .split(/\\s+/)
      .map((p) => p[0] ?? '')
      .slice(0, 2)
      .join('')
      .toUpperCase(),
  );
}

// ---- Actions ---------------------------------------------------------------------
@Component({
  selector: 'aava-button',
  host: { '[style.display]': "fullWidth() ? 'block' : 'inline-block'" },
  template: '<button [type]="type()" [class]="classes()"><ng-content /></button>',
})
export class AavaButton {
  readonly variant = input<string>('primary');
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly fullWidth = input(false, { transform: booleanAttribute });
  readonly icon = input<string>();
  protected readonly classes = computed(() => \`aava-btn aava-btn--\${this.variant()}\${this.fullWidth() ? ' aava-btn--block' : ''}\`);
}

@Component({
  selector: 'aava-link',
  template: \`<a
    class="aava-link"
    [attr.href]="href() || null"
    [attr.role]="href() ? null : 'button'"
    [attr.tabindex]="href() ? null : 0"
    (keydown.enter)="$any($event.target).click()"
    ><ng-content
  /></a>\`,
})
export class AavaLink {
  readonly href = input<string>();
}

// ---- Form controls ----------------------------------------------------------------
@Component({
  selector: 'aava-text-field',
  host: { style: 'display: block' },
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => AavaTextField), multi: true }],
  template: \`
    <div class="aava-field">
      @if (label()) {
        <label [class]="hideLabel() ? 'aava-label sr-only' : 'aava-label'" [for]="id"
          >{{ label() }}
          @if (required()) {
            <span class="aava-req"> *</span>
          }
        </label>
      }
      <input
        class="aava-input"
        [id]="id"
        [type]="type()"
        [placeholder]="placeholder()"
        [required]="required()"
        [disabled]="disabled()"
        [attr.aria-label]="label() ? null : placeholder()"
        [value]="value() ?? ''"
        (input)="update($any($event.target).value)"
        (blur)="touched()"
      />
    </div>
  \`,
})
export class AavaTextField extends AavaValueAccessor<string> {
  readonly id = uid();
  readonly label = input<string>('');
  readonly type = input<string>('text');
  readonly placeholder = input<string>('');
  readonly required = input(false, { transform: booleanAttribute });
  readonly hideLabel = input(false, { transform: booleanAttribute });
}

@Component({
  selector: 'aava-checkbox',
  host: { style: 'display: inline-block' },
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => AavaCheckbox), multi: true }],
  template: \`<label class="aava-check">
    <input type="checkbox" [checked]="!!value()" [disabled]="disabled()" (change)="update($any($event.target).checked)" (blur)="touched()" />
    <span><ng-content /></span>
  </label>\`,
})
export class AavaCheckbox extends AavaValueAccessor<boolean> {}

@Component({
  selector: 'aava-toggle',
  host: { style: 'display: block' },
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => AavaToggle), multi: true }],
  template: \`<label class="aava-toggle">
    <span class="aava-toggle__text">
      <span class="aava-toggle__label">{{ label() }}</span>
      @if (description()) {
        <span class="aava-toggle__desc">{{ description() }}</span>
      }
    </span>
    <input class="aava-toggle__input" type="checkbox" role="switch" [checked]="!!value()" [disabled]="disabled()" (change)="update($any($event.target).checked)" (blur)="touched()" />
  </label>\`,
})
export class AavaToggle extends AavaValueAccessor<boolean> {
  readonly label = input<string>('');
  readonly description = input<string>('');
}

@Component({
  selector: 'aava-select',
  host: { style: 'display: block' },
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => AavaSelect), multi: true }],
  template: \`
    <div class="aava-field">
      <label [class]="hideLabel() ? 'aava-label sr-only' : 'aava-label'" [for]="id">{{ label() }}</label>
      <select class="aava-input aava-select" [id]="id" [disabled]="disabled()" (change)="update($any($event.target).value)" (blur)="touched()">
        @for (o of options(); track o) {
          <option [value]="o" [selected]="o === value()">{{ o }}</option>
        }
      </select>
    </div>
  \`,
})
export class AavaSelect extends AavaValueAccessor<string> {
  readonly id = uid();
  readonly label = input<string>('');
  readonly options = input<readonly string[]>([]);
  readonly hideLabel = input(false, { transform: booleanAttribute });
}

// ---- Data display -------------------------------------------------------------------
@Component({
  selector: 'aava-stat-card',
  host: { style: 'display: block' },
  template: \`<div class="aava-stat" [attr.aria-label]="ariaLabel() || null">
    <span class="aava-stat__label">{{ label() }}</span>
    <span class="aava-stat__value">{{ value() }}</span>
    <span [class]="'aava-stat__delta aava-stat__delta--' + (sentiment() === 'negative' ? 'neg' : 'pos')">{{ trend() === 'up' ? '↑' : '↓' }} {{ delta() }}</span>
  </div>\`,
})
export class AavaStatCard {
  readonly label = input<string>('');
  readonly value = input<string>('');
  readonly delta = input<string>('');
  readonly trend = input<string>('up');
  readonly sentiment = input<string>('positive');
  readonly ariaLabel = input<string>('');
}

export interface AavaBarDatum {
  label: string;
  value: number;
}

@Component({
  selector: 'aava-bar-chart',
  host: { style: 'display: block' },
  template: \`<figure class="aava-chart" [attr.aria-label]="'Bar chart, ' + data().length + ' points'">
    <div class="aava-chart__bars">
      @for (d of data(); track d.label) {
        <div class="aava-chart__col">
          <span class="aava-chart__value">{{ valuePrefix() }}{{ d.value | number: '1.0-0' }}{{ valueSuffix() }}</span>
          <span class="aava-chart__bar" [style.height.%]="(d.value / max()) * 100"></span>
          <span class="aava-chart__label">{{ d.label }}</span>
        </div>
      }
    </div>
  </figure>\`,
  imports: [DecimalPipe],
})
export class AavaBarChart {
  readonly data = input<readonly AavaBarDatum[]>([]);
  readonly valuePrefix = input<string>('');
  readonly valueSuffix = input<string>('');
  protected readonly max = computed(() => Math.max(1, ...this.data().map((d) => d.value)));
}

export interface AavaTableColumn {
  key: string;
  label: string;
  align?: string;
}

const STATUS_TONE: Record<string, string> = { Paid: 'success', Pending: 'warning', Refunded: 'neutral', Failed: 'danger', Active: 'success', Invited: 'warning', Suspended: 'danger', Churned: 'neutral' };

@Component({
  selector: 'aava-table',
  host: { style: 'display: block' },
  template: \`<div class="aava-table-wrap">
    <table class="aava-table">
      <thead>
        <tr>
          @for (c of columns(); track c.key) {
            <th [class.is-end]="c.align === 'end'">{{ c.label }}</th>
          }
        </tr>
      </thead>
      <tbody>
        @for (row of rows(); track $index) {
          <tr [class.is-clickable]="clickable()" (click)="rowClick.emit(row)">
            @for (c of columns(); track c.key) {
              <td [class.is-end]="c.align === 'end'">
                @if (c.key === statusKey()) {
                  <span [class]="'aava-badge aava-badge--' + tone(row[c.key])">{{ row[c.key] }}</span>
                } @else {
                  {{ row[c.key] }}
                }
              </td>
            }
          </tr>
        } @empty {
          <tr>
            <td [attr.colspan]="columns().length">No rows yet</td>
          </tr>
        }
      </tbody>
    </table>
  </div>\`,
})
export class AavaTable {
  readonly columns = input<readonly AavaTableColumn[]>([]);
  readonly rows = input<readonly Record<string, unknown>[]>([]);
  readonly statusKey = input<string>('');
  readonly clickable = input(false, { transform: booleanAttribute });
  readonly rowClick = output<Record<string, unknown>>();
  protected tone(v: unknown): string {
    return STATUS_TONE[String(v)] ?? 'neutral';
  }
}

export interface AavaListItem {
  title: string;
  subtitle?: string;
  meta?: string;
  badge?: string;
  tone?: string;
  unread?: boolean;
}

@Component({
  selector: 'aava-list',
  host: { style: 'display: block' },
  template: \`<ul [class]="variant() === 'grid' ? 'aava-list aava-list--grid' : 'aava-list'">
    @for (item of items(); track $index) {
      <li>
        <button type="button" class="aava-list__item" (click)="itemClick.emit(item)">
          @if (variant() === 'grid') {
            <span class="aava-list__thumb" aria-hidden="true">{{ item.title.charAt(0) }}</span>
          }
          <span class="aava-list__body">
            <span class="aava-list__title">
              @if (item.unread) {
                <span class="aava-dot" aria-label="Unread"></span>
              }
              {{ item.title }}
            </span>
            @if (item.subtitle) {
              <span class="aava-list__sub">{{ item.subtitle }}</span>
            }
          </span>
          <span class="aava-list__aside">
            @if (item.badge) {
              <span [class]="'aava-badge aava-badge--' + (item.tone || 'neutral')">{{ item.badge }}</span>
            }
            @if (item.meta) {
              <span class="aava-list__meta">{{ item.meta }}</span>
            }
          </span>
        </button>
      </li>
    } @empty {
      <li class="aava-text aava-text--subtle">No items yet</li>
    }
  </ul>\`,
})
export class AavaList {
  readonly variant = input<string>('list');
  readonly items = input<readonly AavaListItem[]>([]);
  readonly itemClick = output<AavaListItem>();
}
`.replace("import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';", "import { DecimalPipe } from '@angular/common';\nimport { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';")
