import { Component, ComponentInterface, Element, Event, EventEmitter, Host, Listen, Prop, State, Watch, h, writeTask } from '@stencil/core';

import { getIonMode } from '../../global/ionic-global';
import { Color, SegmentChangeEventDetail, StyleEventDetail } from '../../interface';
import { Gesture, GestureDetail } from '../../utils/gesture';
import { createColorClasses } from '../../utils/theme';

/**
 * @virtualProp {"ios" | "md"} mode - The mode determines which platform styles to use.
 */
@Component({
  tag: 'ion-segment',
  styleUrls: {
    ios: 'segment.ios.scss',
    md: 'segment.md.scss'
  },
  scoped: true
})
export class Segment implements ComponentInterface {
  private gesture?: Gesture;
  private indicatorEl!: HTMLDivElement | undefined;

  private animated = false;
  // private lastDrag = 0;
  private lastIndex!: number;

  @Element() el!: HTMLIonSegmentElement;

  @State() activated = false;

  /**
   * The color to use from your application's color palette.
   * Default options are: `"primary"`, `"secondary"`, `"tertiary"`, `"success"`, `"warning"`, `"danger"`, `"light"`, `"medium"`, and `"dark"`.
   * For more information on colors, see [theming](/docs/theming/basics).
   */
  @Prop() color?: Color;

  /**
   * If `true`, the user cannot interact with the segment.
   */
  @Prop() disabled = false;

  /**
   * If `true`, the segment buttons will overflow and the user can swipe to see them.
   */
  @Prop() scrollable = false;

  /**
   * the value of the segment.
   */
  @Prop({ mutable: true }) value?: string | null;

  /**
   * Emitted when the value property has changed.
   */
  @Event() ionChange!: EventEmitter<SegmentChangeEventDetail>;

  /**
   * Emitted when the styles change.
   */
  @Event() ionStyle!: EventEmitter<StyleEventDetail>;

  @Watch('value')
  valueChanged(value: string | undefined) {
    this.updateButtons();
    this.ionChange.emit({ value });
  }

  @Watch('disabled')
  disabledChanged() {
    if (this.gesture) {
      this.gesture.setDisabled(this.disabled);
    }
  }

  @Listen('ionSelect')
  segmentClick(ev: CustomEvent) {
    const button = ev.target as HTMLIonSegmentButtonElement;
    this.value = button.value;
  }

  componentWillLoad() {
    this.emitStyle();
  }

  async componentDidLoad() {
    if (this.value == null) {
      const checked = this.getButtons().find(b => b.checked);
      if (checked) {
        this.value = checked.value;
      }
    }
    this.updateButtons();

    this.gesture = (await import('../../utils/gesture')).createGesture({
      el: this.el,
      gestureName: 'segment',
      gesturePriority: 100,
      threshold: 0,
      passive: false,
      onStart: ev => this.onStart(ev),
      onMove: ev => this.onMove(ev),
      onEnd: ev => this.onEnd(ev),
    });
    this.disabledChanged();
  }

  componentDidRender() {
    this.calculateIndicatorPosition();
  }

  onStart(detail: GestureDetail) {
    this.activate(detail);

    // touch-action does not work in iOS
    // this.setFocus();
  }

  onMove(detail: GestureDetail) {
    const buttons = this.getButtons();
    const index = buttons.findIndex(button => button.checked === true);

    const activated = this.activated;
    const startEl = buttons[index];

    const currentX = detail.currentX;

    // Get the element that the touch event started on in case
    // it was the checked button, then we will move the indicator
    const rect = startEl.getBoundingClientRect();
    const left = rect.left;
    const width = rect.width;

    // If the indicator is currently activated then we have started the gesture
    // on top of the checked button so we need to slide the indicator
    // by checking the button next to it as we move

    // TODO check for disabled and skip over those
    if (activated) {
      if (currentX < left) {
        const nextIndex = index - 1;

        if (nextIndex >= 0) {
          buttons[nextIndex].checked = true;
        }
      } else if (currentX > (left + width)) {
        const nextIndex = index + 1;

        if (nextIndex < buttons.length) {
          buttons[nextIndex].checked = true;
        }
      }
    } else {
      this.lastIndex = index;

      console.log('last index is', this.lastIndex);
      // if the indicator is not activated we need to follow the index the user
      // moves around by to figure out where they left off
      // TODO
    }
  }

  onEnd(detail: GestureDetail) {
    // If the indicator is not activated then we will just set the indicator
    // where the gesture ended
    if (!this.activated) {
      console.log('not activated set the current button to checked if it is not disabled');
    }

    this.activated = false;

    // this.lastDrag = Date.now();
    detail.event.preventDefault();
    detail.event.stopImmediatePropagation();
  }

  private activate(detail: GestureDetail) {
    const clicked = detail.event.target as HTMLIonSegmentButtonElement;
    const buttons = this.getButtons();
    const checked = buttons.find(button => button.checked === true);

    // If the clicked element does not exist, there is no indicator to activate
    if (!clicked) {
      return;
    }

    // If there are no checked buttons, set the current button to checked
    if (!checked) {
      clicked.checked = true;
    }

    // If the gesture began on the clicked button with the indicator
    // then we should activate the indicator
    if (clicked.checked) {
      this.activated = true;
    }
  }

  private calculateIndicatorPosition() {
    const indicator = this.indicatorEl;
    const activated = this.activated;
    const buttons = this.getButtons();
    const index = buttons.findIndex(button => button.value === this.value);

    // If there is no indicator rendered or there is no checked button
    // then don't move the indicator's position
    if (!indicator || index === -1) {
      return;
    }

    // Transform the indicator based on the index of the button
    const left = `${(index * 100)}%`;
    const width = `calc(${1 / buttons.length * 100}%)`;

    const transform = activated
      ? `translate3d(${left}, 0, 0) scale(0.95)`
      : `translate3d(${left}, 0, 0)`;

    writeTask(() => {
      const indicatorStyle = indicator.style;

      indicatorStyle.width = width;
      indicatorStyle.transform = transform;
      indicatorStyle.display = `block`;
    });

    // After the indicator is set for the first time
    // we can animate it between the segment buttons
    this.animated = true;
  }

  private emitStyle() {
    this.ionStyle.emit({
      'segment': true
    });
  }

  private updateButtons() {
    const value = this.value;
    for (const button of this.getButtons()) {
      button.checked = (button.value === value);
    }
  }

  private getButtons() {
    return Array.from(this.el.querySelectorAll('ion-segment-button'));
  }

  render() {
    const mode = getIonMode(this);
    return (
      <Host
        class={{
          ...createColorClasses(this.color),
          [mode]: true,
          'segment-disabled': this.disabled,
          'segment-scrollable': this.scrollable
        }}
      >
        <div
          part="indicator"
          class={{
            'segment-checked-indicator': true,
            'segment-checked-indicator-animated': this.animated
          }}
          ref={el => this.indicatorEl = el}
        >
          <div class="segment-checked-indicator-background"></div>
        </div>
      </Host>
    );
  }
}
