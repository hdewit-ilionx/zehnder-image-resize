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
const uploadOptions = { bufferSize: 4 * ONE_MEGABYTE, maxBuffers: 20 };

const containerNameLarge = process.env.BLOB_CONTAINER_NAME_LARGE;
const containerNameMedium = process.env.BLOB_CONTAINER_NAME_MEDIUM;
const containerNameSmall = process.env.BLOB_CONTAINER_NAME_SMALL;
const containerNameThumb = process.env.BLOB_CONTAINER_NAME_THUMB;
const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const accessKey = process.env.AZURE_STORAGE_ACCOUNT_ACCESS_KEY;

const sharedKeyCredential = new SharedKeyCredential(
  accountName,
  accessKey);
const pipeline = StorageURL.newPipeline(sharedKeyCredential);
const serviceURL = new ServiceURL(
  `https://${accountName}.blob.core.windows.net`,
  pipeline
);

module.exports = (context, eventGridEvent, inputBlob) => {  

  const aborter = Aborter.timeout(30 * ONE_MINUTE);
  const widthInPixels = 100;
  const contentType = context.bindingData.data.contentType;
  const blobUrl = context.bindingData.data.url;
  const blobName = blobUrl.slice(blobUrl.lastIndexOf("/")+1);
  const widthInPixelsFormatLarge = 1200;
  const widthInPixelsFormatMedium = 600;
  const widthInPixelsFormatSmall = 300;
  const widthInPixelsFormatThumb = 100;

  Jimp.read(inputBlob).then( (thumbnail) => {
    uploadResizedCopy(thumbnail, context, widthInPixelsFormatLarge, containerNameLarge, context);
    uploadResizedCopy(thumbnail, context, widthInPixelsFormatMedium, containerNameMedium, context);
    uploadResizedCopy(thumbnail, context, widthInPixelsFormatSmall, containerNameSmall, context);
    uploadResizedCopy(thumbnail, context, widthInPixelsFormatThumb, containerNameThumb, context);
  });
};

function uploadResizedCopy(thumbnail, widthInPixels, containerName, context) {

  const aborter = Aborter.timeout(30 * ONE_MINUTE);
  const contentType = context.bindingData.data.contentType;
  const blobUrl = context.bindingData.data.url;
  const blobName = blobUrl.slice(blobUrl.lastIndexOf("/")+1);

  thumbnail.resize(widthInPixels, Jimp.AUTO);

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
