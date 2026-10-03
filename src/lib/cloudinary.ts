import { v2 as cloudinary } from 'cloudinary'

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export interface UploadResult {
  url: string
  publicId: string
}

// Upload image to Cloudinary
export async function uploadImage(file: File): Promise<UploadResult> {
  try {
    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    
    // Convert ArrayBuffer to base64 string
    const base64Data = Buffer.from(arrayBuffer).toString('base64')
    
    // Create DataURI string with proper MIME type
    const dataUri = `data:${file.type};base64,${base64Data}`
    
    // Upload using the DataURI string
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: 'whatsapp-catalog-demo',
      transformation: [
        { width: 1200, height: 1200, crop: 'limit' },
        { quality: 'auto:good' },
      ],
    })
    
    return {
      url: result.secure_url,
      publicId: result.public_id,
    }
  } catch (error) {
    console.error('Cloudinary upload error:', error)
    throw error
  }
}

// Delete image from Cloudinary
export async function deleteImage(publicId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId)
  } catch (error) {
    console.error('Error deleting image from Cloudinary:', error)
  }
}