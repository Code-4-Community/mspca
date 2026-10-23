export const matchCanceledEmail = () => ({
  subject: 'Foster Application Update',
  bodyHtml: `
      <p>Hello,</p>
  
      <p>Thank you for your interest in fostering an animal
      through MSPCA.</p>
  
      <p>We wanted to let you know that the animal you
      applied to foster has been matched with another
      foster volunteer and is no longer available.</p>
  
      <p>We appreciate your willingness to help animals
      in need and encourage you to consider other
      fostering opportunities.</p>
  
      <p>Thank you,<br>MSPCA Foster Team</p>
    `,
});
