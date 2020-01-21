const stream = require('stream');
const Jimp = require('jimp');

const {
    Aborter,
    BlobURL,
    BlockBlobURL,
    ContainerURL,
    ServiceURL,
    SharedKeyCredential,
    StorageURL,
    uploadStreamToBlockBlob
} = require("@azure/storage-blob");

const ONE_MEGABYTE = 1024 * 1024;
const ONE_MINUTE = 60 * 1000;
const uploadOptions = { bufferSize: 5 * ONE_MEGABYTE, maxBuffers:  20 };
const aborter = Aborter.timeout(30 * ONE_MINUTE);

const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const accessKey = process.env.AZURE_STORAGE_ACCOUNT_ACCESS_KEY;
const containerNameUpload = process.env.BLOB_CONTAINER_NAME;
const containerNameFullsize = process.env.BLOB_CONTAINER_NAME_FULLSIZE;
const containerNameLarge = process.env.BLOB_CONTAINER_NAME_LARGE;
const containerNameMedium = process.env.BLOB_CONTAINER_NAME_MEDIUM;
const containerNameSmall = process.env.BLOB_CONTAINER_NAME_SMALL;
const containerNameThumb = process.env.BLOB_CONTAINER_NAME_THUMB;

/**
let widthInPixelsFormatLarge = parseInt(process.env.IMAGE_WIDTH_LARGE);
let widthInPixelsFormatMedium = parseInt(process.env.IMAGE_WIDTH_MEDIUM);
let widthInPixelsFormatSmall = parseInt(process.env.IMAGE_WIDTH_SMALL);
let widthInPixelsFormatThumb = parseInt(process.env.IMAGE_WIDTH_THUMB);
 **/

const widthInPixelsFormatLarge = 1200;
const widthInPixelsFormatMedium = 600;
const widthInPixelsFormatSmall = 300;
const widthInPixelsFormatThumb = 100;

const sharedKeyCredential = new SharedKeyCredential(
    accountName,
    accessKey);
const pipeline = StorageURL.newPipeline(sharedKeyCredential);
const serviceURL = new ServiceURL(
    `https://${accountName}.blob.core.windows.net`,
    pipeline
);

module.exports = (context, eventGridEvent, inputBlob) => {

    const blobUrl = context.bindingData.data.url;
    const blobName = blobUrl.slice(blobUrl.lastIndexOf("/")+1);
    context.log("Image " + blobName + " uploaded to " + containerNameUpload);
    if (blobUrl.indexOf("/" + containerNameUpload + "/") > -1) {
        Jimp.read(inputBlob).then( (thumbnail) => {
            uploadResizedCopy(thumbnail, context, 0, containerNameFullsize, false);
            uploadResizedCopy(thumbnail, context, widthInPixelsFormatLarge, containerNameLarge, true);
            uploadResizedCopy(thumbnail, context, widthInPixelsFormatMedium, containerNameMedium, true);
            uploadResizedCopy(thumbnail, context, widthInPixelsFormatSmall, containerNameSmall, true);
            uploadResizedCopy(thumbnail, context, widthInPixelsFormatThumb, containerNameThumb, true);
        });
    } else {
        context.done();
    }
};

function uploadResizedCopy(thumbnail, context, widthInPixels, containerName, doResize) {

    const contentType = context.bindingData.data.contentType;
    const blobUrl = context.bindingData.data.url;
    const blobName = blobUrl.slice(blobUrl.lastIndexOf("/")+1);

    if (doResize) {
        thumbnail.resize(widthInPixels, Jimp.AUTO);
        context.log("Image " + blobName + " resized to width " + widthInPixels);
    };
    context.log("Upload " + fileName + " to container " + containerName);

    const options = {
        contentSettings: { contentType: contentType }
    };

    thumbnail.getBuffer(Jimp.MIME_PNG, async (err, buffer) => {

        const readStream = stream.PassThrough();
        readStream.end(buffer);

        const containerURL = ContainerURL.fromServiceURL(serviceURL, containerName);
        const blockBlobURL = BlockBlobURL.fromContainerURL(containerURL, blobName);

        try {
            await uploadStreamToBlockBlob(aborter, readStream,
                blockBlobURL, uploadOptions.bufferSize, uploadOptions.maxBuffers,
                { blobHTTPHeaders: { blobContentType: "image/jpeg" } });
        } catch (err) {
            context.log(err.message);
        } finally {
            context.done();
        }
    });
}
