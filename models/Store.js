const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
const slug = require('slugs');

const storeSchema = new mongoose.Schema({
    name: {
        type: String,
        trim: true,
        required: 'Please enter a store name.!'
    },
    slug: String,
    description: {
        type: String,
        trim: true
    },
    tags: [String],
    created: {
        type: Date,
        default: Date.now
    },
    location: {
        type: {
            type: String,
            default: 'Point'
        },
        coordinates: [{
            type: Number,
            required: 'You must supply coordinates.'
        }],
        address: {
            type: String,
            required: 'You must supply an address.'
        }
    },
    photo: String,
    author: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: 'You must supply an author.'
    }
}, {
        toJson: { virtual: true },
        toObject: { virtual: true }
    });

//Define indexes
storeSchema.index({
    name: 'text',
    description: 'text'
});

storeSchema.index({
    location: '2dsphere'
});

storeSchema.pre('save', async function (next) {
    if (!this.isModified('name')) {
        next();
        return;
    }
    this.slug = slug(this.name);
    const slugRegExp = new RegExp(`^(${this.slug})((-[0-9]*$)?)$`, 'i');
    const storeWithSlug = await this.constructor.find({ slug: slugRegExp });
    if (storeWithSlug.length)
        this.slug = `${this.slug}-${storeWithSlug.length + 1}`;
    next();
});

storeSchema.statics.getTagsList = function () {
    return this.aggregate([
        { $unwind: '$tags' },
        { $group: { _id: '$tags', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
    ]);
};

storeSchema.statics.getTopStores = function () {
    return this.aggregate([
        //Lookup stores and populate their reviews
        { $lookup: { from: 'reviews', localField: '_id', foreignField: 'store', as: 'reviews' } },
        //Filter only item that have 2 or more reviews
        { $match: { 'reviews.1': { $exists: true } } },
        //Add the averange reviews field
        { $project: { 
            photo: '$$ROOT.photo',
            name: '$$ROOT.name',
            slug: '$$ROOT.slug',
            reviews: '$$ROOT.reviews',
            averangeRating: { $avg: '$reviews.rating'} } 
        },
        //Sort it by out new field, highest reviews firts
        { $sort: { averangeRating: -1 } },
        //Limit to at most 10
        { $limit: 10 }
    ]);
};

storeSchema.virtual('reviews', {
    ref: 'Review', //What model to link
    localField: '_id', //Which field on the store
    foreignField: 'store' //Which field on the review
});

function autopopulate(next) {
    this.populate('reviews');
    next();
}

storeSchema.pre('find', autopopulate);
storeSchema.pre('findOne', autopopulate);

module.exports = mongoose.model('Store', storeSchema);