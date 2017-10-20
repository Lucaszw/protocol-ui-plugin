require('!style-loader!css-loader!backgrid/lib/backgrid.min.css');

var _ = require('lodash');
var $ = jQuery = require('jquery');
var Backbone = require('backbone');
var Backgrid = require('backgrid');
var key = require('keyboard-shortcut');
var yo = require('yo-yo');

var MqttClient = require('@mqttclient/web');

class ProtocolTable {
  constructor() {
    this.element = document.createElement("div");
    this.clickHandler = _.noop;
    this.editHandler  = _.noop;
  }

  render(schema, steps, stepNumber) {
    const _this = this;
    // Clear the old ui
    this.element.innerHTML = "";
    this.element.style.opacity = "1";
    this.element.style.pointerEvents = "auto";
    this.element.style.zoom = 0.75;

    const columns = this.SchemaToBackgridColumns(schema);
    const collection = new Backbone.Collection();
    collection.add(steps);
    collection.on("change", (model) => {this.editHandler(model)});

    var grid = new Backgrid.Grid({
      columns: columns,
      collection: collection
    });

    this.element.appendChild(grid.render().el);


    // Highlight the current stepNumber:
    const row = grid.el.rows[stepNumber+1];
    if (row)  {row.style.background = "rgb(229, 248, 255)";}

    return this.element;
  }

  SelectableCell(constructor, editable=true) {
    const _this = this;
    const obj = {
      enterEditMode: function (...args) {
        _this.clickHandler(this, _this, editable, ...args);
      }
    };
    return constructor.extend(obj);
  }

  SchemaToBackgridColumns(schema) {
    let columns = new Object();

    // Return the proper cell constructor for each schema o
    const getCell = (v) => {
      if (!v.type) v.type = "string";
      var capitalized = v.type.charAt(0).toUpperCase() + v.type.slice(1);
      var cellType = `${capitalized}Cell`;
      return this.SelectableCell(Backgrid[cellType]);
    }

    // Create column object for each entry of schema
    for (const [k,v] of Object.entries(schema)) {
      if (!_.isPlainObject(v)) continue;
      // XXX: Temporarily overridiing number type (should change in schema)
      if (v.type == "number") v.type = "integer";
      const column = new Object();
      column.name = k;
      column.label = k;
      column.cell = getCell(v);
      columns[k] = column;
    }

    // Customize step column so that is is non-editable
    if (columns["step"]) {
      columns["step"].cell =
        this.SelectableCell(Backgrid["StringCell"], false);
    }

    return _.values(columns);
  }
}

class ProtocolUI extends UIPlugin {
  constructor(elem, focusTracker) {
    super(elem, focusTracker, "ProtocolUI");
    this.table = new ProtocolTable();
    this.table.clickHandler = this.click.bind(this);
    this.table.editHandler = this.edit.bind(this);
    this.microdrop = new MicrodropAsync();
  }

  listen() {
    this.onStateMsg("step-model", "steps", this.render.bind(this));
    this.onStateMsg("step-model", "step-number", this.render.bind(this));
    key("delete", this.delete.bind(this));
  }

  async delete() {
    const LABEL = "<ProtocolUI::delete>";
    try {
      const stepNumber = await this.microdrop.steps.currentStepNumber();
      await this.microdrop.steps.deleteStep(stepNumber);
      return;
    } catch (e) {
      throw([LABEL, e]);
    }
  }

  async next() {
    const LABEL = "<ProtocolUI::next>";
    try {
      const stepNumber = await this.microdrop.steps.currentStepNumber();
      const steps = await this.microdrop.steps.steps();
      if (stepNumber + 1 >= steps.length)
        await this.microdrop.steps.insertStep(stepNumber);
      if (stepNumber + 1 < steps.length)
        await this.microdrop.steps.putStepNumber(stepNumber + 1);
      return;
    } catch (e) {
      throw([LABEL, e]);
    }
  }

  async prev() {
    const LABEL = "<ProtocolUI::prev>";
    try {
      const stepNumber = await this.microdrop.steps.currentStepNumber();
      const steps = await this.microdrop.steps.steps();
      if (stepNumber - 1 < 0)
        this.microdrop.steps.putStepNumber(steps.length-1);
      if (stepNumber - 1 >= 0)
        this.microdrop.steps.putStepNumber(stepNumber - 1);
      return;
    } catch (e) {
      throw([LABEL, e]);
    }
  }
  async click(view, protocolTable, editable, event) {
    const LABEL = "<ProtocolUI::click>";
    const stepNumber = await this.microdrop.steps.currentStepNumber();
    const stepClicked = view.model.attributes.step;
    if (stepNumber != stepClicked){
      await this.microdrop.steps.putStepNumber(stepClicked);
      return;
    }
    if (editable == false) return;
    view.constructor.__super__.enterEditMode.apply(view, event);
  }

  async edit(model) {
    const LABEL = "<ProtocolUI::edit>";
    console.log(LABEL, this, model);
    if (_.isEmpty(model.changed)) return;
    const stepNumber = model.attributes.step;
    const key = Object.keys(model.changed)[0];
    const val = Object.values(model.changed)[0];
    console.log(LABEL, key, val, stepNumber);
    return this.microdrop.steps.updateStep(key, val, stepNumber);
  }

  async render() {
    const LABEL = "<ProtocolUI::render>";
    try {
      const steps  = await this.microdrop.steps.steps();
      const schema = await this.microdrop.schema.flatten();
      const stepNumber = await this.microdrop.steps.currentStepNumber();
      console.log(LABEL, "STEPS", steps);
      console.log(LABEL, "SCHEMA", schema);
      
      const node = yo`
        <div>
          <div class="btn-group">
            <button type="button" onclick=${this.prev.bind(this)}
              class="btn btn-secondary btn-sm">Prev</button>
            <button type="button" onclick=${this.next.bind(this)}
              class="btn btn-secondary btn-sm">Next</button>
          </div>
          ${this.table.render(schema, steps, stepNumber)}
        </div>`;

      this.element.innerHTML = "";
      this.element.appendChild(node);
      return this.element;
    } catch (e) {
      throw([LABEL, e]);
    }
  }
}

module.exports = ProtocolUI;
