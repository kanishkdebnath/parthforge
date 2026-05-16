import mongoose from 'mongoose';

export async function connectDb(url: string): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(url);
}
