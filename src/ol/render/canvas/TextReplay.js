/**
 * @module ol/render/canvas/TextReplay
 */
import {getUid, inherits} from '../../index.js';
import {asColorLike} from '../../colorlike.js';
import {createCanvasContext2D} from '../../dom.js';
import {intersects} from '../../extent.js';
import _ol_geom_flat_straightchunk_ from '../../geom/flat/straightchunk.js';
import GeometryType from '../../geom/GeometryType.js';
import _ol_has_ from '../../has.js';
import _ol_render_canvas_ from '../canvas.js';
import _ol_render_canvas_Instruction_ from '../canvas/Instruction.js';
import _ol_render_canvas_Replay_ from '../canvas/Replay.js';
import _ol_render_replay_ from '../replay.js';
import TextPlacement from '../../style/TextPlacement.js';

/**
 * @constructor
 * @extends {ol.render.canvas.Replay}
 * @param {number} tolerance Tolerance.
 * @param {ol.Extent} maxExtent Maximum extent.
 * @param {number} resolution Resolution.
 * @param {number} pixelRatio Pixel ratio.
 * @param {boolean} overlaps The replay can have overlapping geometries.
 * @param {?} declutterTree Declutter tree.
 * @struct
 */
const _ol_render_canvas_TextReplay_ = function(
  tolerance, maxExtent, resolution, pixelRatio, overlaps, declutterTree) {
  _ol_render_canvas_Replay_.call(this,
    tolerance, maxExtent, resolution, pixelRatio, overlaps, declutterTree);

  /**
   * @private
   * @type {ol.DeclutterGroup}
   */
  this.declutterGroup_;

  /**
   * @private
   * @type {Array.<HTMLCanvasElement>}
   */
  this.labels_ = null;

  /**
   * @private
   * @type {string}
   */
  this.text_ = '';

  /**
   * @private
   * @type {number}
   */
  this.textOffsetX_ = 0;

  /**
   * @private
   * @type {number}
   */
  this.textOffsetY_ = 0;

  /**
   * @private
   * @type {boolean|undefined}
   */
  this.textRotateWithView_ = undefined;

  /**
   * @private
   * @type {number}
   */
  this.textRotation_ = 0;

  /**
   * @private
   * @type {?ol.CanvasFillState}
   */
  this.textFillState_ = null;

  /**
   * @type {Object.<string, ol.CanvasFillState>}
   */
  this.fillStates = {};

  /**
   * @private
   * @type {?ol.CanvasStrokeState}
   */
  this.textStrokeState_ = null;

  /**
   * @type {Object.<string, ol.CanvasStrokeState>}
   */
  this.strokeStates = {};

  /**
   * @private
   * @type {ol.CanvasTextState}
   */
  this.textState_ = /** @type {ol.CanvasTextState} */ ({});

  /**
   * @type {Object.<string, ol.CanvasTextState>}
   */
  this.textStates = {};

  /**
   * @private
   * @type {string}
   */
  this.textKey_ = '';

  /**
   * @private
   * @type {string}
   */
  this.fillKey_ = '';

  /**
   * @private
   * @type {string}
   */
  this.strokeKey_ = '';

  /**
   * @private
   * @type {Object.<string, Object.<string, number>>}
   */
  this.widths_ = {};

  const labelCache = _ol_render_canvas_.labelCache;
  labelCache.prune();

};

inherits(_ol_render_canvas_TextReplay_, _ol_render_canvas_Replay_);


/**
 * @param {string} font Font to use for measuring.
 * @param {Array.<string>} lines Lines to measure.
 * @param {Array.<number>} widths Array will be populated with the widths of
 * each line.
 * @return {number} Width of the whole text.
 */
_ol_render_canvas_TextReplay_.measureTextWidths = function(font, lines, widths) {
  const numLines = lines.length;
  let width = 0;
  let currentWidth, i;
  for (i = 0; i < numLines; ++i) {
    currentWidth = _ol_render_canvas_.measureTextWidth(font, lines[i]);
    width = Math.max(width, currentWidth);
    widths.push(currentWidth);
  }
  return width;
};


/**
 * @inheritDoc
 */
_ol_render_canvas_TextReplay_.prototype.drawText = function(geometry, feature) {
  const fillState = this.textFillState_;
  const strokeState = this.textStrokeState_;
  const textState = this.textState_;
  if (this.text_ === '' || !textState || (!fillState && !strokeState)) {
    return;
  }

  let begin = this.coordinates.length;

  const geometryType = geometry.getType();
  let flatCoordinates = null;
  let end = 2;
  let stride = 2;
  let i, ii;

  if (textState.placement === TextPlacement.LINE) {
    if (!intersects(this.getBufferedMaxExtent(), geometry.getExtent())) {
      return;
    }
    let ends;
    flatCoordinates = geometry.getFlatCoordinates();
    stride = geometry.getStride();
    if (geometryType == GeometryType.LINE_STRING) {
      ends = [flatCoordinates.length];
    } else if (geometryType == GeometryType.MULTI_LINE_STRING) {
      ends = geometry.getEnds();
    } else if (geometryType == GeometryType.POLYGON) {
      ends = geometry.getEnds().slice(0, 1);
    } else if (geometryType == GeometryType.MULTI_POLYGON) {
      const endss = geometry.getEndss();
      ends = [];
      for (i = 0, ii = endss.length; i < ii; ++i) {
        ends.push(endss[i][0]);
      }
    }
    this.beginGeometry(geometry, feature);
    const textAlign = textState.textAlign;
    let flatOffset = 0;
    let flatEnd;
    for (let o = 0, oo = ends.length; o < oo; ++o) {
      if (textAlign == undefined) {
        const range = _ol_geom_flat_straightchunk_.lineString(
          textState.maxAngle, flatCoordinates, flatOffset, ends[o], stride);
        flatOffset = range[0];
        flatEnd = range[1];
      } else {
        flatEnd = ends[o];
      }
      for (i = flatOffset; i < flatEnd; i += stride) {
        this.coordinates.push(flatCoordinates[i], flatCoordinates[i + 1]);
      }
      end = this.coordinates.length;
      flatOffset = ends[o];
      this.drawChars_(begin, end, this.declutterGroup_);
      begin = end;
    }
    this.endGeometry(geometry, feature);

  } else {
    const label = this.getImage(this.text_, this.textKey_, this.fillKey_, this.strokeKey_);
    const width = label.width / this.pixelRatio;
    switch (geometryType) {
      case GeometryType.POINT:
      case GeometryType.MULTI_POINT:
        flatCoordinates = geometry.getFlatCoordinates();
        end = flatCoordinates.length;
        break;
      case GeometryType.LINE_STRING:
        flatCoordinates = /** @type {ol.geom.LineString} */ (geometry).getFlatMidpoint();
        break;
      case GeometryType.CIRCLE:
        flatCoordinates = /** @type {ol.geom.Circle} */ (geometry).getCenter();
        break;
      case GeometryType.MULTI_LINE_STRING:
        flatCoordinates = /** @type {ol.geom.MultiLineString} */ (geometry).getFlatMidpoints();
        end = flatCoordinates.length;
        break;
      case GeometryType.POLYGON:
        flatCoordinates = /** @type {ol.geom.Polygon} */ (geometry).getFlatInteriorPoint();
        if (!textState.overflow && flatCoordinates[2] / this.resolution < width) {
          return;
        }
        stride = 3;
        break;
      case GeometryType.MULTI_POLYGON:
        const interiorPoints = /** @type {ol.geom.MultiPolygon} */ (geometry).getFlatInteriorPoints();
        flatCoordinates = [];
        for (i = 0, ii = interiorPoints.length; i < ii; i += 3) {
          if (textState.overflow || interiorPoints[i + 2] / this.resolution >= width) {
            flatCoordinates.push(interiorPoints[i], interiorPoints[i + 1]);
          }
        }
        end = flatCoordinates.length;
        if (end == 0) {
          return;
        }
        break;
      default:
    }
    end = this.appendFlatCoordinates(flatCoordinates, 0, end, stride, false, false);
    this.beginGeometry(geometry, feature);
    if (textState.backgroundFill || textState.backgroundStroke) {
      this.setFillStrokeStyle(textState.backgroundFill, textState.backgroundStroke);
      this.updateFillStyle(this.state, this.createFill, geometry);
      this.hitDetectionInstructions.push(this.createFill(this.state, geometry));
      this.updateStrokeStyle(this.state, this.applyStroke);
      this.hitDetectionInstructions.push(this.createStroke(this.state));
    }
    this.drawTextImage_(label, begin, end);
    this.endGeometry(geometry, feature);
  }
};


/**
 * @param {string} text Text.
 * @param {string} textKey Text style key.
 * @param {string} fillKey Fill style key.
 * @param {string} strokeKey Stroke style key.
 * @return {HTMLCanvasElement} Image.
 */
_ol_render_canvas_TextReplay_.prototype.getImage = function(text, textKey, fillKey, strokeKey) {
  let label;
  const key = strokeKey + textKey + text + fillKey + this.pixelRatio;

  const labelCache = _ol_render_canvas_.labelCache;
  if (!labelCache.containsKey(key)) {
    const strokeState = strokeKey ? this.strokeStates[strokeKey] || this.textStrokeState_ : null;
    const fillState = fillKey ? this.fillStates[fillKey] || this.textFillState_ : null;
    const textState = this.textStates[textKey] || this.textState_;
    const pixelRatio = this.pixelRatio;
    const scale = textState.scale * pixelRatio;
    const align =  _ol_render_replay_.TEXT_ALIGN[textState.textAlign || _ol_render_canvas_.defaultTextAlign];
    const strokeWidth = strokeKey && strokeState.lineWidth ? strokeState.lineWidth : 0;

    const lines = text.split('\n');
    const numLines = lines.length;
    const widths = [];
    const width = _ol_render_canvas_TextReplay_.measureTextWidths(textState.font, lines, widths);
    const lineHeight = _ol_render_canvas_.measureTextHeight(textState.font);
    const height = lineHeight * numLines;
    const renderWidth = (width + strokeWidth);
    const context = createCanvasContext2D(
      Math.ceil(renderWidth * scale),
      Math.ceil((height + strokeWidth) * scale));
    label = context.canvas;
    labelCache.set(key, label);
    if (scale != 1) {
      context.scale(scale, scale);
    }
    context.font = textState.font;
    if (strokeKey) {
      context.strokeStyle = strokeState.strokeStyle;
      context.lineWidth = strokeWidth * (_ol_has_.SAFARI ? scale : 1);
      context.lineCap = strokeState.lineCap;
      context.lineJoin = strokeState.lineJoin;
      context.miterLimit = strokeState.miterLimit;
      if (_ol_has_.CANVAS_LINE_DASH && strokeState.lineDash.length) {
        context.setLineDash(strokeState.lineDash);
        context.lineDashOffset = strokeState.lineDashOffset;
      }
    }
    if (fillKey) {
      context.fillStyle = fillState.fillStyle;
    }
    context.textBaseline = 'middle';
    context.textAlign = 'center';
    const leftRight = (0.5 - align);
    const x = align * label.width / scale + leftRight * strokeWidth;
    let i;
    if (strokeKey) {
      for (i = 0; i < numLines; ++i) {
        context.strokeText(lines[i], x + leftRight * widths[i], 0.5 * (strokeWidth + lineHeight) + i * lineHeight);
      }
    }
    if (fillKey) {
      for (i = 0; i < numLines; ++i) {
        context.fillText(lines[i], x + leftRight * widths[i], 0.5 * (strokeWidth + lineHeight) + i * lineHeight);
      }
    }
  }
  return labelCache.get(key);
};


/**
 * @private
 * @param {HTMLCanvasElement} label Label.
 * @param {number} begin Begin.
 * @param {number} end End.
 */
_ol_render_canvas_TextReplay_.prototype.drawTextImage_ = function(label, begin, end) {
  const textState = this.textState_;
  const strokeState = this.textStrokeState_;
  const pixelRatio = this.pixelRatio;
  const align = _ol_render_replay_.TEXT_ALIGN[textState.textAlign || _ol_render_canvas_.defaultTextAlign];
  const baseline = _ol_render_replay_.TEXT_ALIGN[textState.textBaseline];
  const strokeWidth = strokeState && strokeState.lineWidth ? strokeState.lineWidth : 0;

  const anchorX = align * label.width / pixelRatio + 2 * (0.5 - align) * strokeWidth;
  const anchorY = baseline * label.height / pixelRatio + 2 * (0.5 - baseline) * strokeWidth;
  this.instructions.push([_ol_render_canvas_Instruction_.DRAW_IMAGE, begin, end,
    label, (anchorX - this.textOffsetX_) * pixelRatio, (anchorY - this.textOffsetY_) * pixelRatio,
    this.declutterGroup_, label.height, 1, 0, 0, this.textRotateWithView_, this.textRotation_,
    1, true, label.width,
    textState.padding == _ol_render_canvas_.defaultPadding ?
      _ol_render_canvas_.defaultPadding : textState.padding.map(function(p) {
        return p * pixelRatio;
      }),
    !!textState.backgroundFill, !!textState.backgroundStroke
  ]);
  this.hitDetectionInstructions.push([_ol_render_canvas_Instruction_.DRAW_IMAGE, begin, end,
    label, (anchorX - this.textOffsetX_) * pixelRatio, (anchorY - this.textOffsetY_) * pixelRatio,
    this.declutterGroup_, label.height, 1, 0, 0, this.textRotateWithView_, this.textRotation_,
    1 / pixelRatio, true, label.width, textState.padding,
    !!textState.backgroundFill, !!textState.backgroundStroke
  ]);
};


/**
 * @private
 * @param {number} begin Begin.
 * @param {number} end End.
 * @param {ol.DeclutterGroup} declutterGroup Declutter group.
 */
_ol_render_canvas_TextReplay_.prototype.drawChars_ = function(begin, end, declutterGroup) {
  const strokeState = this.textStrokeState_;
  const textState = this.textState_;
  const fillState = this.textFillState_;

  const strokeKey = this.strokeKey_;
  if (strokeState) {
    if (!(strokeKey in this.strokeStates)) {
      this.strokeStates[strokeKey] = /** @type {ol.CanvasStrokeState} */ ({
        strokeStyle: strokeState.strokeStyle,
        lineCap: strokeState.lineCap,
        lineDashOffset: strokeState.lineDashOffset,
        lineWidth: strokeState.lineWidth,
        lineJoin: strokeState.lineJoin,
        miterLimit: strokeState.miterLimit,
        lineDash: strokeState.lineDash
      });
    }
  }
  const textKey = this.textKey_;
  if (!(this.textKey_ in this.textStates)) {
    this.textStates[this.textKey_] = /** @type {ol.CanvasTextState} */ ({
      font: textState.font,
      textAlign: textState.textAlign || _ol_render_canvas_.defaultTextAlign,
      scale: textState.scale
    });
  }
  const fillKey = this.fillKey_;
  if (fillState) {
    if (!(fillKey in this.fillStates)) {
      this.fillStates[fillKey] = /** @type {ol.CanvasFillState} */ ({
        fillStyle: fillState.fillStyle
      });
    }
  }

  const pixelRatio = this.pixelRatio;
  const baseline = _ol_render_replay_.TEXT_ALIGN[textState.textBaseline];

  const offsetY = this.textOffsetY_ * pixelRatio;
  const text = this.text_;
  const font = textState.font;
  const textScale = textState.scale;
  const strokeWidth = strokeState ? strokeState.lineWidth * textScale / 2 : 0;
  let widths = this.widths_[font];
  if (!widths) {
    this.widths_[font] = widths = {};
  }
  this.instructions.push([_ol_render_canvas_Instruction_.DRAW_CHARS,
    begin, end, baseline, declutterGroup,
    textState.overflow, fillKey, textState.maxAngle,
    function(text) {
      let width = widths[text];
      if (!width) {
        width = widths[text] = _ol_render_canvas_.measureTextWidth(font, text);
      }
      return width * textScale * pixelRatio;
    },
    offsetY, strokeKey, strokeWidth * pixelRatio, text, textKey, 1
  ]);
  this.hitDetectionInstructions.push([_ol_render_canvas_Instruction_.DRAW_CHARS,
    begin, end, baseline, declutterGroup,
    textState.overflow, fillKey, textState.maxAngle,
    function(text) {
      let width = widths[text];
      if (!width) {
        width = widths[text] = _ol_render_canvas_.measureTextWidth(font, text);
      }
      return width * textScale;
    },
    offsetY, strokeKey, strokeWidth, text, textKey, 1 / pixelRatio
  ]);
};


/**
 * @inheritDoc
 */
_ol_render_canvas_TextReplay_.prototype.setTextStyle = function(textStyle, declutterGroup) {
  let textState, fillState, strokeState;
  if (!textStyle) {
    this.text_ = '';
  } else {
    this.declutterGroup_ = /** @type {ol.DeclutterGroup} */ (declutterGroup);

    const textFillStyle = textStyle.getFill();
    if (!textFillStyle) {
      fillState = this.textFillState_ = null;
    } else {
      fillState = this.textFillState_;
      if (!fillState) {
        fillState = this.textFillState_ = /** @type {ol.CanvasFillState} */ ({});
      }
      fillState.fillStyle = asColorLike(
        textFillStyle.getColor() || _ol_render_canvas_.defaultFillStyle);
    }

    const textStrokeStyle = textStyle.getStroke();
    if (!textStrokeStyle) {
      strokeState = this.textStrokeState_ = null;
    } else {
      strokeState = this.textStrokeState_;
      if (!strokeState) {
        strokeState = this.textStrokeState_ = /** @type {ol.CanvasStrokeState} */ ({});
      }
      const lineDash = textStrokeStyle.getLineDash();
      const lineDashOffset = textStrokeStyle.getLineDashOffset();
      const lineWidth = textStrokeStyle.getWidth();
      const miterLimit = textStrokeStyle.getMiterLimit();
      strokeState.lineCap = textStrokeStyle.getLineCap() || _ol_render_canvas_.defaultLineCap;
      strokeState.lineDash = lineDash ? lineDash.slice() : _ol_render_canvas_.defaultLineDash;
      strokeState.lineDashOffset =
          lineDashOffset === undefined ? _ol_render_canvas_.defaultLineDashOffset : lineDashOffset;
      strokeState.lineJoin = textStrokeStyle.getLineJoin() || _ol_render_canvas_.defaultLineJoin;
      strokeState.lineWidth =
          lineWidth === undefined ? _ol_render_canvas_.defaultLineWidth : lineWidth;
      strokeState.miterLimit =
          miterLimit === undefined ? _ol_render_canvas_.defaultMiterLimit : miterLimit;
      strokeState.strokeStyle = asColorLike(
        textStrokeStyle.getColor() || _ol_render_canvas_.defaultStrokeStyle);
    }

    textState = this.textState_;
    const font = textStyle.getFont() || _ol_render_canvas_.defaultFont;
    _ol_render_canvas_.checkFont(font);
    const textScale = textStyle.getScale();
    textState.overflow = textStyle.getOverflow();
    textState.font = font;
    textState.maxAngle = textStyle.getMaxAngle();
    textState.placement = textStyle.getPlacement();
    textState.textAlign = textStyle.getTextAlign();
    textState.textBaseline = textStyle.getTextBaseline() || _ol_render_canvas_.defaultTextBaseline;
    textState.backgroundFill = textStyle.getBackgroundFill();
    textState.backgroundStroke = textStyle.getBackgroundStroke();
    textState.padding = textStyle.getPadding() || _ol_render_canvas_.defaultPadding;
    textState.scale = textScale === undefined ? 1 : textScale;

    const textOffsetX = textStyle.getOffsetX();
    const textOffsetY = textStyle.getOffsetY();
    const textRotateWithView = textStyle.getRotateWithView();
    const textRotation = textStyle.getRotation();
    this.text_ = textStyle.getText() || '';
    this.textOffsetX_ = textOffsetX === undefined ? 0 : textOffsetX;
    this.textOffsetY_ = textOffsetY === undefined ? 0 : textOffsetY;
    this.textRotateWithView_ = textRotateWithView === undefined ? false : textRotateWithView;
    this.textRotation_ = textRotation === undefined ? 0 : textRotation;

    this.strokeKey_ = strokeState ?
      (typeof strokeState.strokeStyle == 'string' ? strokeState.strokeStyle : getUid(strokeState.strokeStyle)) +
      strokeState.lineCap + strokeState.lineDashOffset + '|' + strokeState.lineWidth +
      strokeState.lineJoin + strokeState.miterLimit + '[' + strokeState.lineDash.join() + ']' :
      '';
    this.textKey_ = textState.font + textState.scale + (textState.textAlign || '?');
    this.fillKey_ = fillState ?
      (typeof fillState.fillStyle == 'string' ? fillState.fillStyle : ('|' + getUid(fillState.fillStyle))) :
      '';
  }
};
export default _ol_render_canvas_TextReplay_;
