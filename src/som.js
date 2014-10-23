'use strict';

var NodeSquare = require('./node-square'),
    NodeHexagonal = require('./node-hexagonal');

var defaultOptions = {
    fields: 3,
    randomizer: Math.random,
    distance: squareEuclidean,
    iterations: 1000,
    learningRate: 0.1,
    gridType: 'rectangular'
};

function SOM(x, y, options) {
    if (!(x > 0 && y > 0)) {
        throw new Error('x and y must be positive');
    }
    options = options || {};
    for (var i in defaultOptions) {
        if (!options.hasOwnProperty(i)) {
            options[i] = defaultOptions[i];
        }
    }
    this.x = x;
    this.y = y;
    this.numNodes = x * y;

    this.randomizer = options.randomizer;
    this.distance = options.distance;

    this.iterationCount = 0;
    this.numIterations = options.iterations;

    this.startLearningRate = this.learningRate = options.learningRate;

    if (typeof options.fields === 'number') {
        this.numWeights = options.fields;
        this.extractor = null;
    } else {
        var fields = Object.keys(options.fields);
        this.numWeights = fields.length;
        var converters = getConverters(fields, options.fields);
        this.extractor = converters.extractor;
        this.creator = converters.creator;
    }

    this.mapRadius = Math.floor(Math.max(x, y) / 2);
    this.timeConstant = this.numIterations / Math.log(this.mapRadius);

    this.nodeType = options.gridType === 'rectangular' ? NodeSquare : NodeHexagonal;
    this.initNodes();

    this.done = false;
}

SOM.prototype.initNodes = function initNodes() {

    var SOMNode = this.nodeType;
    this.nodes = new Array(this.numNodes);
    for (var i = 0; i < this.x; i++) {
        for (var j = 0; j < this.y; j++) {
            var weights = new Array(this.numWeights);
            for (var k = 0; k < this.numWeights; k++) {
                weights[k] = this.randomizer();
            }
            this.nodes[i * this.x + j] = new SOMNode(i, j, weights);
        }
    }

};

SOM.prototype.setTraining = function setTraining(trainingSet) {
    var convertedSet = trainingSet;
    var i;
    if (this.extractor) {
        convertedSet = new Array(trainingSet);
        for (i = 0; i < trainingSet.length; i++) {
            convertedSet[i] = this.extractor(trainingSet[i]);
        }
    }
    this.trainingSet = convertedSet;
};

SOM.prototype.trainOne = function trainOne() {
    if (this.done) {
        return false;
    } else if (this.numIterations-- > 0) {

        var i, bmu, trainingValue, neighbourhoodRadius, influence;
        trainingValue = getRandomValue(this.trainingSet, this.randomizer);
        bmu = this.findBestMatchingUnit(trainingValue);

        neighbourhoodRadius = this.mapRadius * Math.exp(-this.iterationCount / this.timeConstant);

        for (i = 0; i < this.nodes.length; i++) {
            var dist = bmu.getDistance(this.nodes[i]);
            if (dist < neighbourhoodRadius) {
                influence = Math.exp(-dist / (2 * neighbourhoodRadius));
                this.nodes[i].adjustWeights(trainingValue, this.learningRate, influence);
            }
        }

        this.learningRate = this.startLearningRate * Math.exp(-this.iterationCount / this.numIterations);

        this.iterationCount++;

        return true;

    } else {
        this.done = true;
        return false;
    }
};

SOM.prototype.train = function train(trainingSet) {

    this.setTraining(trainingSet);
    while(this.trainOne()){}

};

SOM.prototype.getConvertedNodes = function getConvertedNodes() {
    var nodes = this.nodes;
    var result = [];
    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        if (!result[node.x]) {
            result[node.x] = [];
        }
        result[node.x][node.y] = this.creator(node.weights);
    }
    return result;
};

SOM.prototype.findBestMatchingUnit = function findBestMatchingUnit(candidate) {

    var bmu,
        lowest = Infinity,
        dist;

    for (var i = 0; i < this.numNodes; i++) {
        dist = this.distance(this.nodes[i].weights, candidate);
        if (dist < lowest) {
            lowest = dist;
            bmu = this.nodes[i];
        }
    }

    return bmu;

};

function getConverters(fields, fieldsOpt) {
    var l = fields.length,
        normalizers = new Array(l),
        denormalizers = new Array(l);
    for (var i = 0; i < l; i++) {
        normalizers[i] = getNormalizer(fieldsOpt[fields[i]]);
        denormalizers[i] = getDenormalizer(fieldsOpt[fields[i]]);
    }
    return {
        extractor: function extractor(value) {
            var result = new Array(l);
            for (var i = 0; i < l; i++) {
                result[i] = normalizers[i](value[fields[i]]);
            }
            return result;
        },
        creator: function creator(value) {
            var result = {};
            for (var i = 0; i < l; i++) {
                result[fields[i]] = denormalizers[i](value[i]);
            }
            return result;
        }
    };
}

function getNormalizer(minMax) {
    return function normalizer(value) {
        return (value - minMax[0]) / (minMax[1] - minMax[0]);
    };
}

function getDenormalizer(minMax) {
    return function denormalizer(value) {
        return (minMax[0] + value * (minMax[1] - minMax[0]));
    };
}

function squareEuclidean(a, b) {
    var d = 0;
    for (var i = 0, ii = a.length; i < ii; i++) {
        d += (a[i] - b[i]) * (a[i] - b[i]);
    }
    return d;
}

function getRandomValue(arr, randomizer) {
    return arr[Math.floor(randomizer() * arr.length)];
}

module.exports = SOM;