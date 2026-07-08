/**
 * @fileoverview Technical Specification: Core Data Contracts
 * This file documents the rigid, immutable data structures for the osu! Map Mixer project
 * using JSDoc type definitions. These structures govern how the editor reads, stores,
 * transforms, and compiles map data in pure JavaScript.
 */

/**
 * @typedef {Object} ProjectState
 * @property {string} appVersion - Semantic version of the project format (for migration scripts)
 * @property {ProjectMetadata} metadata
 * @property {TimingSegment[]} globalTimingSegments - Definitive global timeline for BPM and beat calculations
 * @property {Object.<string, SourceAsset>} sourceAssets - Read-only registry of all imported source maps
 * @property {MapClip[]} masterTimeline - Ordered sequence of clips on the master timeline
 */

/**
 * @typedef {Object} ProjectMetadata
 * @property {string} title
 * @property {string} artist
 * @property {string} creator
 * @property {string} audioFilename - Filename of the audio file inside the .omp archive
 * @property {number} previewTime - Preview start time in milliseconds (osu! standard)
 * @property {string[]} [tags] - Optional standard osu! metadata tags
 * @property {string} [source] - Optional source game/anime/etc.
 * @property {number} [beatmapSetId] - Optional beatmap set ID
 */

/**
 * @typedef {Object} SourceAsset
 * @property {string} assetId - Unique ID (typically a hash of the file contents or a UUID)
 * @property {string} difficultyName - e.g., "Insane", "Expert"
 * @property {number} originalBpm - Reference base BPM of this source file (used for UI display)
 * @property {RawTimingPoint[]} timingPoints - Inherited and uninherited timing points from the source
 * @property {HitObject[]} hitObjects - List of beat-mapped hit objects
 */

/**
 * @typedef {Object} RawTimingPoint
 * @property {number} beat - The exact relative float beat where this point takes effect
 * @property {number} msPerBeat - BPM calculations: 60000 / msPerBeat
 * @property {number} meter - Time signature (usually 4)
 * @property {number} sampleSet
 * @property {number} sampleIndex
 * @property {number} volume - 0 to 100
 * @property {boolean} uninherited - true = Red Line (BPM change), false = Green Line (SV/Volume change)
 * @property {number} sliderVelocityMult - Inherited velocity multiplier (e.g., 1.0, 1.4)
 */

/**
 * @typedef {"circle" | "slider" | "spinner"} HitObjectType
 */

/**
 * @typedef {Object} HitObject
 * @property {string} id - Unique ID (UUIDv4) generated on parse
 * @property {HitObjectType} type
 * @property {number} beat - Float beat offset relative to the source map's metronome start
 * @property {number} originalTimeMs - Kept only for reference/debugging during ingestion
 * @property {number} x - Coordinate space (0 to 512)
 * @property {number} y - Coordinate space (0 to 384)
 * @property {number} comboNumber - Position in current combo
 * @property {boolean} isNewCombo - NC flag
 * @property {number} hitsound - Hitsound bitmask
 * @property {SliderData} [sliderData]
 * @property {SpinnerData} [spinnerData]
 */

/**
 * @typedef {Object} SliderData
 * @property {"Bezier" | "Linear" | "Catmull" | "PerfectCurve"} curveType
 * @property {number} pixelLength - The intended visual length of the slider
 * @property {number} slides - Total repeats + 1 (1 = single run, 2 = repeat once, etc.)
 * @property {number[]} edgeHitsounds - Array length must equal `slides`
 * @property {string[]} edgeAdditions - Array length must equal `slides`
 * @property {BakedPathPoint[]} bakedPath - Pre-calculated list of 2D points along the curve
 */

/**
 * @typedef {Object} BakedPathPoint
 * @property {number} x
 * @property {number} y
 * @property {number} dist - Cumulative pixel distance from the slider head (0 to pixelLength)
 */

/**
 * @typedef {Object} SpinnerData
 * @property {number} durationBeats - How many relative beats the spinner lasts
 * @property {number} endBeat - beat + durationBeats
 */

/**
 * @typedef {Object} MapClip
 * @property {string} clipId - Unique ID (UUID) for this timeline instance
 * @property {string} sourceAssetId - Points to a SourceAsset key in sourceAssets
 * @property {number} timelineStartBeat - Timeline Placement (in global Master beat space)
 * @property {number} timelineEndBeat
 * @property {number} sourceStartBeat - Internal source offset
 * @property {ClipTransforms} transforms - Non-destructive transformations
 * @property {string[]} deletedObjectIds - Objects explicitly removed by the user in this clip instance
 */

/**
 * @typedef {Object} ClipTransforms
 * @property {number} spatialScale - Scale relative to the selection's bounding box center (default: 1.0)
 * @property {number} rotationDegrees - Rotation in degrees around the bounding box center (default: 0)
 * @property {number} offsetX
 * @property {number} offsetY
 * @property {boolean} mirrorX - Flip horizontally across bounding box center
 * @property {boolean} mirrorY - Flip vertically across bounding box center
 */

/**
 * @typedef {Object} TimingSegment
 * @property {string} segmentId
 * @property {number} startMs - Exact absolute millisecond where the segment begins
 * @property {number} bpm
 * @property {number} beatOffset - The cumulative relative float beat count at startMs
 */

// This file is a self-contained JSDoc type declaration manifest and exports no runtime code.
export {};
