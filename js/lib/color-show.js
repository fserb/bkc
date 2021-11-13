// color-show.js
import Tonic from "./tonic.js";


class ColorShow extends Tonic {

  connected() {
    this.updated();
  }

  updated() {
    const s = this.querySelector('#s');

    if (this.props.color) {
      s.style.backgroundColor = this.props.color;
      s.classList.remove('grad');
      return;
    }

    s.classList.add('grad');
    s.style.backgroundImage = `linear-gradient(to right, ${this.props.grad})`;
  }

  stylesheet() {
    return `
#s {
  display: inline-block;
  width: 0.75em;
  height: 0.75em;
  vertical-align: -0.075em;
  border: 0.125em solid rgba(0, 0, 0, 0.4);
  border-radius: 0.15em;
  background-origin: border-box;
}

.grad {
  height: 0.85em !important;
  width: 5em !important;
}
    `;
  }
  render() {
    return this.html`<div id=s></div>`;
  }
}
Tonic.add(ColorShow);
