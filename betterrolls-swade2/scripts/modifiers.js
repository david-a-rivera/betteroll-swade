// Modifier class
/* global Roll */

export class TraitModifier {
  /**
   * Creates a this
   * @param {string} label
   * @param {String, Number} expression
   */
  constructor(label, expression) {
    this.name = label;
    this.value = 0;
    this.dice = null;
    if (isNaN(expression)) {
      if (expression.indexOf("d") > 0) {
        // This is a die expression
        this.dice = new Roll(expression);
      } else {
        // sourcery skip: no-eval
        this.value = eval(expression); // jshint ignore:line
      }
    } else {
      // Add float this support
      this.value = parseFloat(expression);
    }
  }

  async evaluate() {
    if (this.dice) {
      await this.dice.evaluate();
      this.value = parseInt(this.dice.result);
    }
  }

  get extra_class() {
    return this.value < 0 ? " twbr-underline" : "";
  }
}

export class DamageModifier extends TraitModifier {}
