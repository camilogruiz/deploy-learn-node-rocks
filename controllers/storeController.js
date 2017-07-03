const mongoose = require('mongoose');
const Store = mongoose.model('Store');
const User = mongoose.model('User');
const jimp = require('jimp');
const uuid = require('uuid');
const multer = require('multer');
const multerOptions = {
    storage: multer.memoryStorage(),
    fileFilter(req, file, next) {
        const isPhoto = file.mimetype.startsWith('image/');
        if (isPhoto)
            next(null, true);
        else
            next({ message: 'That filetype isn\'t allow' }, false)
    }
}

exports.myMiddleware = (req, res, next) => {
    req.name = 'Camilo';
    next();
};

exports.homePage = (req, res) => {
    console.log(req.name);
    res.render('index');
};

exports.addStore = (req, res) => {
    res.render('editStore', { title: 'Add store' });
};

exports.upload = multer(multerOptions).single('photo');

exports.resize = async (req, res, next) => {
    if (!req.file) {
        next();
        return;
    }
    const extension = req.file.mimetype.split('/')[1];
    req.body.photo = `${uuid.v4()}.${extension}`;
    //Resize
    const photo = await jimp.read(req.file.buffer);
    await photo.resize(800, jimp.AUTO);
    await photo.write(`./public/uploads/${req.body.photo}`);
    next();
};

exports.createStore = async (req, res) => {
    req.body.author = req.user._id;
    const store = await (new Store(req.body)).save();
    req.flash('success', `Successfully created ${store.name}. Care to leave a review?`);
    res.redirect(`/store/${store.slug}`);
};

exports.getStores = async (req, res) => {
    const page = req.params.page || 1;
    const limit = 4;
    const skip = (page * limit) - limit;
    //1. Get the database for a list of all stores
    const storesPromise = Store
        .find()
        .skip(skip)
        .limit(limit)
        .sort({ created: 'desc'});

const countPromise = Store.count();

const [stores, count] = await Promise.all([storesPromise, countPromise]);
const pages = Math.ceil(count / limit);

if (!stores.length && skip) {
    req.flash('info', `Hey you ask for ${page}. But that does not exist. So I put you on page ${pages}`);
    res.redirect(`/stores/page/${pages}`);
    return;
}
res.render('stores', { title: 'Stores', stores, page, pages, count });
};

const confirmOwner = (store, user) => {
    if (!store.author.equals(user._id))
        throw Error('You must own a store in order to edit it.');
};

exports.editStore = async (req, res) => {
    //1. Find the store given the ID
    const store = await Store.findOne({ _id: req.params.id });
    console.log(store);
    //2. Confirm they are the owner of the store
    confirmOwner(store, req.user);
    //3. Render out the edit form so the user can update their store
    res.render('editStore', { title: `Edit ${store.name}`, store });
};


exports.updateStore = async (req, res) => {
    //Set location
    req.body.location.type = 'Point';
    //1. Find and update the store
    const store = await Store.findOneAndUpdate({ _id: req.params.id }, req.body,
        {
            new: true, // Return the new store instead of the old one
            runValidators: true
        }).exec();
    req.flash('success', `Successfully updated <strong>${store.name}</strong>. <a href="/stores/${store.slug}">View store</a>`);
    //1. Redirect them the store and tell them it worked
    res.redirect(`/stores/${store._id}/edit`);
};

exports.getStoreBySlug = async (req, res, next) => {
    const store = await Store.findOne({ slug: req.params.slug }).populate('author reviews');;
    if (!store) return next();
    res.render('store', { title: store.name, store });
};

exports.getStoreByTag = async (req, res) => {
    const tag = req.params.tag;
    const tagQuery = tag || { $exists: true };
    const tagsPromise = Store.getTagsList();
    const storesPromise = Store.find({ tags: tagQuery });
    const [tags, stores] = await Promise.all([tagsPromise, storesPromise]);
    res.render('tag', { title: 'Tags', tags, tag, stores })
};

exports.searchStores = async (req, res) => {
    const stores = await Store
        //First find the store that match
        .find({
            $text: {
                $search: req.query.q
            }
        }, {
            score: { $meta: 'textScore' }
        })
        //Sort
        .sort({
            score: { $meta: 'textScore' }
        })
        //Only limimt to 5 results
        .limit(5);
    res.json(stores);
};

exports.mapsStores = async (req, res) => {
    const coordinates = [req.query.lng, req.query.lat].map(parseFloat);
    const q = {
        location: {
            $near: {
                $geometry: {
                    type: 'Point',
                    coordinates
                },
                //$maxDistance: 10000 //10Km
            }
        }
    };

    const stores = await Store.find(q).select('slug name description location photo').limit(10);
    res.json(stores);

};

exports.mapPage = (req, res) => {
    res.render('map', { title: 'Map' });
};

exports.heartStore = async (req, res) => {
    const hearts = req.user.hearts.map(obj => obj.toString());
    const operator = hearts.includes(req.params.id) ? '$pull' : '$addToSet';
    const user = await User
        .findByIdAndUpdate(req.user._id,
        { [operator]: { hearts: req.params.id } },
        { new: true }
        );
    res.json(user);
};

exports.getHearts = async (req, res) => {
    const stores = await Store.find({
        _id: { $in: req.user.hearts }
    });

    res.render('stores', { title: 'Heated store', stores });
};

exports.getTopStores = async (req, res) => {
    const stores = await Store.getTopStores();
    // res.json(stores);
    res.render('topStores', { title: '★ Top Stores', stores });
};